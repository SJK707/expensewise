import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  EXPENSE_CATEGORIES,
  formatINR,
  todayLocal,
  monthRange,
  shiftMonth,
  monthLabel,
} from '../lib/constants'

export default function Budgets() {
  const currentMonth = todayLocal().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)

  const [budgets, setBudgets] = useState([])
  const [spent, setSpent] = useState({}) // { Food: 1500, Travel: 800 }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Add / edit form
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)

  const monthStart = `${month}-01`

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')

      const { start, end } = monthRange(month)

      const [budgetRes, expenseRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('month', start),
        supabase
          .from('transactions')
          .select('category, amount')
          .eq('type', 'expense')
          .gte('date', start)
          .lt('date', end),
      ])

      if (ignore) return

      if (budgetRes.error || expenseRes.error) {
        setError((budgetRes.error || expenseRes.error).message)
      } else {
        setBudgets(budgetRes.data)
        const totals = {}
        for (const r of expenseRes.data) {
          totals[r.category] = (totals[r.category] || 0) + Number(r.amount)
        }
        setSpent(totals)
      }
      setLoading(false)
    }

    load()
    return () => {
      ignore = true
    }
  }, [month, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const value = Number(limit)
    if (!value || value <= 0) {
      setError('Enter a limit greater than 0.')
      return
    }

    setSaving(true)
    // upsert: creates the budget, or updates it if this category already has one this month
    const { error } = await supabase
      .from('budgets')
      .upsert(
        { category, monthly_limit: value, month: monthStart },
        { onConflict: 'user_id,category,month' }
      )
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setLimit('')
    reload()
  }

  const handleDelete = async (b) => {
    if (!window.confirm(`Remove the ${b.category} budget?`)) return
    const { error } = await supabase.from('budgets').delete().eq('id', b.id)
    if (error) setError(error.message)
    else reload()
  }

  const handleCopyLast = async () => {
    setError('')
    setMessage('')

    const prevStart = `${shiftMonth(month, -1)}-01`
    const { data: prev, error: prevErr } = await supabase
      .from('budgets')
      .select('category, monthly_limit')
      .eq('month', prevStart)

    if (prevErr) {
      setError(prevErr.message)
      return
    }

    const existing = new Set(budgets.map((b) => b.category))
    const toCopy = prev.filter((p) => !existing.has(p.category))

    if (prev.length === 0) {
      setMessage('Last month has no budgets to copy.')
      return
    }
    if (toCopy.length === 0) {
      setMessage('Every category from last month already has a budget here.')
      return
    }

    const { error: insErr } = await supabase.from('budgets').insert(
      toCopy.map((p) => ({
        category: p.category,
        monthly_limit: p.monthly_limit,
        month: monthStart,
      }))
    )

    if (insErr) {
      setError(insErr.message)
      return
    }

    setMessage(`Copied ${toCopy.length} budget${toCopy.length > 1 ? 's' : ''} from last month.`)
    reload()
  }

  // Overall totals
  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0)
  const totalSpentInBudgets = budgets.reduce((s, b) => s + (spent[b.category] || 0), 0)

  // Spending in categories that have no budget
  const unbudgeted = Object.entries(spent).filter(
    ([cat]) => !budgets.some((b) => b.category === cat)
  )

  const sorted = [...budgets].sort((a, b) => {
    const pa = (spent[a.category] || 0) / Number(a.monthly_limit)
    const pb = (spent[b.category] || 0) / Number(b.monthly_limit)
    return pb - pa // closest to the limit first
  })

  const inputClass =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-4">
      {/* Month switcher */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="px-3 py-2 rounded-lg bg-white shadow text-slate-600 hover:bg-slate-50"
          aria-label="Previous month"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-slate-800">Budgets · {monthLabel(month)}</h1>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="px-3 py-2 rounded-lg bg-white shadow text-slate-600 hover:bg-slate-50"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Add / update budget */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl shadow p-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Monthly limit (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="3000"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className={`${inputClass} w-36`}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          {saving ? 'Saving...' : 'Set budget'}
        </button>
        <button
          type="button"
          onClick={handleCopyLast}
          className="text-sm text-slate-500 hover:text-emerald-600 border border-slate-200 rounded-lg px-3 py-2"
        >
          Copy last month's budgets
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      {loading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : (
        <>
          {/* Overall */}
          {budgets.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Total budgeted</p>
              <p className="text-lg font-semibold text-slate-800">
                {formatINR(totalSpentInBudgets)}{' '}
                <span className="text-sm font-normal text-slate-500">
                  of {formatINR(totalBudget)} spent
                </span>
              </p>
            </div>
          )}

          {/* Per-category progress */}
          <div className="bg-white rounded-2xl shadow p-4">
            {sorted.length === 0 ? (
              <p className="text-slate-400">
                No budgets for {monthLabel(month)} yet. Set one above, or copy last month's.
              </p>
            ) : (
              <ul className="space-y-5">
                {sorted.map((b) => {
                  const limitNum = Number(b.monthly_limit)
                  const used = spent[b.category] || 0
                  const pct = (used / limitNum) * 100
                  const left = limitNum - used

                  const barColor =
                    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'

                  return (
                    <li key={b.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-medium text-slate-800">{b.category}</span>
                        <span className="text-sm text-slate-500">
                          {formatINR(used)} / {formatINR(limitNum)}
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span
                          className={`text-xs ${left < 0 ? 'text-red-500' : 'text-slate-500'}`}
                        >
                          {left >= 0
                            ? `${formatINR(left)} left · ${Math.round(pct)}% used`
                            : `Over by ${formatINR(Math.abs(left))}`}
                        </span>
                        <span className="flex gap-3">
                          <button
                            onClick={() => {
                              setCategory(b.category)
                              setLimit(String(limitNum))
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="text-xs text-slate-500 hover:text-emerald-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(b)}
                            className="text-xs text-slate-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Spending with no budget */}
          {unbudgeted.length > 0 && budgets.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold text-slate-800 mb-2">Spending with no budget</h2>
              <ul className="divide-y divide-slate-100">
                {unbudgeted.map(([cat, amt]) => (
                  <li key={cat} className="py-2 flex justify-between text-sm">
                    <span className="text-slate-700">{cat}</span>
                    <span className="text-slate-500">{formatINR(amt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}