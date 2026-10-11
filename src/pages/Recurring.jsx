import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EXPENSE_CATEGORIES, formatINR, todayLocal } from '../lib/constants'

const KINDS = [
  ['emi', 'EMI'],
  ['sip', 'SIP'],
  ['rent', 'Rent'],
  ['subscription', 'Subscription'],
  ['insurance', 'Insurance'],
  ['other', 'Other'],
]

// Suggested expense category for each kind (you can still change it)
const DEFAULT_CATEGORY = {
  emi: 'EMI',
  sip: 'Other',
  rent: 'Bills',
  subscription: 'Entertainment',
  insurance: 'Bills',
  other: 'Other',
}

const FREQUENCIES = [
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
]

const pad = (n) => String(n).padStart(2, '0')

// addPeriod("2026-10-31", "monthly") -> "2026-11-30" (clamps to the month's last day)
function addPeriod(dateStr, frequency) {
  const [y, m, d] = dateStr.split('-').map(Number)

  if (frequency === 'weekly') {
    const next = new Date(y, m - 1, d + 7)
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
  }

  const monthsToAdd = frequency === 'yearly' ? 12 : 1
  const targetFirst = new Date(y, m - 1 + monthsToAdd, 1)
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate()
  return `${targetFirst.getFullYear()}-${pad(targetFirst.getMonth() + 1)}-${pad(
    Math.min(d, lastDay)
  )}`
}

// Whole days from today until the due date (negative = overdue)
function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(y, m - 1, d) - today) / 86400000)
}

function dueStatus(r) {
  if (!r.is_active) return { text: 'Paused', color: 'text-slate-400' }
  const days = daysUntil(r.next_due_date)
  if (days < 0)
    return { text: `Overdue by ${-days} day${-days > 1 ? 's' : ''}`, color: 'text-red-500' }
  if (days === 0) return { text: 'Due today', color: 'text-amber-600' }
  if (days <= 7)
    return { text: `Due in ${days} day${days > 1 ? 's' : ''}`, color: 'text-amber-600' }
  return { text: `Due in ${days} days`, color: 'text-slate-500' }
}

// Convert any frequency to a per-month amount for the commitments total
function monthlyEquivalent(r) {
  const a = Number(r.amount)
  if (r.frequency === 'weekly') return (a * 52) / 12
  if (r.frequency === 'yearly') return a / 12
  return a
}

export default function Recurring() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState(null)

  // Add / edit form
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState('emi')
  const [category, setCategory] = useState(DEFAULT_CATEGORY.emi)
  const [frequency, setFrequency] = useState('monthly')
  const [nextDue, setNextDue] = useState(todayLocal())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*')
        .order('next_due_date', { ascending: true })

      if (ignore) return
      if (error) setError(error.message)
      else setItems(data)
      setLoading(false)
    }

    load()
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setAmount('')
    setKind('emi')
    setCategory(DEFAULT_CATEGORY.emi)
    setFrequency('monthly')
    setNextDue(todayLocal())
  }

  const handleKindChange = (k) => {
    setKind(k)
    setCategory(DEFAULT_CATEGORY[k])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const value = Number(amount)
    if (!name.trim()) {
      setError('Give the payment a name.')
      return
    }
    if (!value || value <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }

    setSaving(true)
    const row = {
      name: name.trim(),
      amount: value,
      kind,
      category,
      frequency,
      next_due_date: nextDue,
    }

    const { error } = editingId
      ? await supabase.from('recurring_payments').update(row).eq('id', editingId)
      : await supabase.from('recurring_payments').insert(row)
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }
    resetForm()
    reload()
  }

  const handleEdit = (r) => {
    setEditingId(r.id)
    setName(r.name)
    setAmount(String(r.amount))
    setKind(r.kind)
    setCategory(r.category || DEFAULT_CATEGORY[r.kind])
    setFrequency(r.frequency)
    setNextDue(r.next_due_date)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete "${r.name}"? Past transactions stay in your history.`)) return
    const { error } = await supabase.from('recurring_payments').delete().eq('id', r.id)
    if (error) setError(error.message)
    else reload()
  }

  const handleToggle = async (r) => {
    const { error } = await supabase
      .from('recurring_payments')
      .update({ is_active: !r.is_active })
      .eq('id', r.id)
    if (error) setError(error.message)
    else reload()
  }

  const handleMarkPaid = async (r) => {
    setError('')
    setMessage('')

    const ok = window.confirm(
      `Record ${formatINR(r.amount)} for "${r.name}" as an expense dated today, and move the due date forward?`
    )
    if (!ok) return

    setBusyId(r.id)

    // 1) Create the expense
    const { error: txError } = await supabase.from('transactions').insert({
      amount: Number(r.amount),
      type: 'expense',
      category: r.category || 'Other',
      description: r.name,
      date: todayLocal(),
      payment_method: 'UPI',
    })

    if (txError) {
      setBusyId(null)
      setError(txError.message)
      return
    }

    // 2) Move the due date to the next cycle
    const next = addPeriod(r.next_due_date, r.frequency)
    const { error: upError } = await supabase
      .from('recurring_payments')
      .update({ next_due_date: next })
      .eq('id', r.id)

    setBusyId(null)

    if (upError) {
      setError(
        `The expense was saved, but the due date could not be updated (${upError.message}). Don't click Mark as paid again. Edit the due date manually instead.`
      )
    } else {
      setMessage(`Recorded "${r.name}". Next due ${next}.`)
    }
    reload()
  }

  const active = items.filter((r) => r.is_active)
  const monthlyTotal = active.reduce((s, r) => s + monthlyEquivalent(r), 0)
  const dueSoon = active.filter((r) => daysUntil(r.next_due_date) <= 7).length

  // Active first (already sorted by due date), paused at the bottom
  const sorted = [...active, ...items.filter((r) => !r.is_active)]

  const inputClass =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Recurring payments</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Monthly commitments</p>
          <p className="text-xl font-semibold text-slate-800">{formatINR(monthlyTotal)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Active payments, averaged per month</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Due within 7 days (or overdue)</p>
          <p
            className={`text-xl font-semibold ${
              dueSoon > 0 ? 'text-amber-600' : 'text-slate-800'
            }`}
          >
            {dueSoon}
          </p>
        </div>
      </div>

      {/* Add / edit form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">
          {editingId ? 'Edit payment' : 'New recurring payment'}
        </h2>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              placeholder="Education EMI"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="2500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={kind}
              onChange={(e) => handleKindChange(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Expense category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Repeats</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {FREQUENCIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Next due date</label>
            <input
              type="date"
              required
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add payment'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      {/* List */}
      {loading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-6 text-slate-400">
          Nothing here yet. Add your EMIs, SIPs, rent or subscriptions above.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const status = dueStatus(r)
            const kindLabel = KINDS.find(([v]) => v === r.kind)?.[1] ?? r.kind
            return (
              <li
                key={r.id}
                className={`bg-white rounded-2xl shadow p-4 ${r.is_active ? '' : 'opacity-60'}`}
              >
                <div className="flex justify-between items-baseline gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {kindLabel} · {r.frequency} · {r.category || 'Other'}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-800 shrink-0">{formatINR(r.amount)}</p>
                </div>

                <p className={`text-xs mt-2 ${status.color}`}>
                  {status.text} · {r.next_due_date}
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                  {r.is_active && (
                    <button
                      onClick={() => handleMarkPaid(r)}
                      disabled={busyId === r.id}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-3 py-1.5"
                    >
                      {busyId === r.id ? 'Saving...' : 'Mark as paid'}
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    onClick={() => handleToggle(r)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    {r.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleEdit(r)}
                    className="text-xs text-slate-500 hover:text-emerald-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}