import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/constants'

const PRESETS = ['📱 Phone Fund', '🏦 Emergency Fund', '👩 Family', '💰 General Savings']

function GoalCard({ goal, onEdit, onDelete, onChanged }) {
  const [mode, setMode] = useState(null) // 'add' | 'withdraw' | null
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const target = Number(goal.target_amount)
  const saved = Number(goal.current_amount)
  const pct = (saved / target) * 100
  const remaining = Math.max(target - saved, 0)
  const done = saved >= target

  // "Save X per month" hint
  let hint = null
  if (goal.deadline && !done) {
    const [y, m, d] = goal.deadline.split('-').map(Number)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.round((new Date(y, m - 1, d) - today) / 86400000)
    if (days < 0) {
      hint = { text: `Deadline passed (${goal.deadline})`, warn: true }
    } else {
      const months = Math.max(1, Math.ceil(days / 30))
      hint = {
        text: `Save ${formatINR(remaining / months)}/month for ${months} month${
          months > 1 ? 's' : ''
        } to finish by ${goal.deadline}`,
      }
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')

    const value = Number(amount)
    if (!value || value <= 0) {
      setErr('Enter an amount greater than 0.')
      return
    }
    if (mode === 'withdraw' && value > saved) {
      setErr(`You only have ${formatINR(saved)} in this goal.`)
      return
    }

    setBusy(true)
    const next = mode === 'add' ? saved + value : saved - value
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: next })
      .eq('id', goal.id)
    setBusy(false)

    if (error) {
      setErr(error.message)
      return
    }
    setAmount('')
    setMode(null)
    onChanged()
  }

  return (
    <li className="bg-white rounded-2xl shadow p-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-semibold text-slate-800">{goal.name}</span>
        <span className="text-sm text-slate-500">
          {formatINR(saved)} / {formatINR(target)}
        </span>
      </div>

      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <p className="text-xs mt-1 text-slate-500">
        {done
          ? '🎉 Goal reached!'
          : `${Math.round(pct)}% · ${formatINR(remaining)} to go`}
      </p>
      {hint && (
        <p className={`text-xs mt-0.5 ${hint.warn ? 'text-red-500' : 'text-slate-400'}`}>
          {hint.text}
        </p>
      )}

      <div className="flex gap-3 mt-3 text-sm">
        <button
          onClick={() => {
            setMode(mode === 'add' ? null : 'add')
            setErr('')
          }}
          className="text-emerald-600 hover:underline"
        >
          + Add money
        </button>
        <button
          onClick={() => {
            setMode(mode === 'withdraw' ? null : 'withdraw')
            setErr('')
          }}
          className="text-slate-500 hover:text-slate-800"
        >
          Withdraw
        </button>
        <span className="flex-1" />
        <button onClick={() => onEdit(goal)} className="text-xs text-slate-500 hover:text-emerald-600">
          Edit
        </button>
        <button onClick={() => onDelete(goal)} className="text-xs text-slate-500 hover:text-red-600">
          Delete
        </button>
      </div>

      {mode && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            autoFocus
            placeholder={mode === 'add' ? 'Amount to add' : 'Amount to withdraw'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {busy ? '...' : mode === 'add' ? 'Add' : 'Withdraw'}
          </button>
        </form>
      )}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </li>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [available, setAvailable] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Add / edit form
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')

      const [goalRes, txRes] = await Promise.all([
        supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
        supabase.from('transactions').select('type, amount'),
      ])

      if (ignore) return

      if (goalRes.error || txRes.error) {
        setError((goalRes.error || txRes.error).message)
      } else {
        setGoals(goalRes.data)

        const income = txRes.data
          .filter((t) => t.type === 'income')
          .reduce((s, t) => s + Number(t.amount), 0)
        const expense = txRes.data
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + Number(t.amount), 0)
        const inGoals = goalRes.data.reduce((s, g) => s + Number(g.current_amount), 0)
        setAvailable(income - expense - inGoals)
      }
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
    setTarget('')
    setDeadline('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')

    const targetNum = Number(target)
    if (!name.trim()) {
      setError('Give the goal a name.')
      return
    }
    if (!targetNum || targetNum <= 0) {
      setError('Enter a target greater than 0.')
      return
    }

    setSaving(true)
    const row = {
      name: name.trim(),
      target_amount: targetNum,
      deadline: deadline || null,
    }

    const { error } = editingId
      ? await supabase.from('savings_goals').update(row).eq('id', editingId)
      : await supabase.from('savings_goals').insert(row)
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }
    resetForm()
    reload()
  }

  const handleEdit = (g) => {
    setEditingId(g.id)
    setName(g.name)
    setTarget(String(g.target_amount))
    setDeadline(g.deadline ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (g) => {
    const msg =
      Number(g.current_amount) > 0
        ? `Delete "${g.name}"? Its ${formatINR(g.current_amount)} will go back to "Available to allocate".`
        : `Delete "${g.name}"?`
    if (!window.confirm(msg)) return

    const { error } = await supabase.from('savings_goals').delete().eq('id', g.id)
    if (error) setError(error.message)
    else reload()
  }

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0)

  const inputClass =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Goals & Money Buckets</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Saved in buckets</p>
          <p className="text-xl font-semibold text-emerald-600">{formatINR(totalSaved)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Available to allocate</p>
          <p
            className={`text-xl font-semibold ${
              available < 0 ? 'text-red-500' : 'text-slate-800'
            }`}
          >
            {formatINR(available)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            All-time income − expenses − money in buckets
          </p>
        </div>
      </div>

      {/* Add / edit form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">
          {editingId ? 'Edit goal' : 'New goal'}
        </h2>

        {!editingId && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setName(p)}
                className="text-xs border border-slate-200 rounded-full px-3 py-1 text-slate-600 hover:border-emerald-500 hover:text-emerald-600"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              placeholder="📱 Phone Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Target (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder="70000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={`${inputClass} w-32`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Deadline (optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create goal'}
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

      {/* Goals */}
      {loading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : goals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-6 text-slate-400">
          No goals yet. Pick a preset above or type your own name to create your first bucket.
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChanged={reload}
            />
          ))}
        </ul>
      )}
    </div>
  )
}