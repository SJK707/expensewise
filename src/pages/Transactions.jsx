import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TransactionForm from '../components/TransactionForm'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatINR,
  todayLocal,
} from '../lib/constants'

const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])]

// "2026-10" -> { start: "2026-10-01", end: "2026-11-01" }
function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end }
}

export default function Transactions() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7)) // "" = all time
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')

      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (month) {
        const { start, end } = monthRange(month)
        q = q.gte('date', start).lt('date', end)
      }
      if (type !== 'all') q = q.eq('type', type)
      if (category !== 'all') q = q.eq('category', category)
      if (search.trim()) q = q.ilike('description', `%${search.trim()}%`)

      const { data, error } = await q
      if (ignore) return

      if (error) setError(error.message)
      else setRows(data)
      setLoading(false)
    }

    load()
    return () => {
      ignore = true
    }
  }, [month, type, category, search, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  const handleDelete = async (t) => {
    const ok = window.confirm(
      `Delete ${t.category} ${formatINR(t.amount)} on ${t.date}? This can't be undone.`
    )
    if (!ok) return

    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (error) setError(error.message)
    else reload()
  }

  const clearFilters = () => {
    setMonth('')
    setType('all')
    setCategory('all')
    setSearch('')
  }

  const income = rows
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + Number(r.amount), 0)
  const expense = rows
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + Number(r.amount), 0)

  const inputClass =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow p-4 grid gap-3 grid-cols-2 md:grid-cols-5">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={inputClass}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
        />
        <button
          onClick={clearFilters}
          className="text-sm text-slate-500 hover:text-emerald-600 border border-slate-200 rounded-lg px-3 py-2"
        >
          Show all time
        </button>
      </div>

      {/* Totals for the current filter */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Income</p>
          <p className="text-lg font-semibold text-emerald-600">{formatINR(income)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Expenses</p>
          <p className="text-lg font-semibold text-red-500">{formatINR(expense)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-slate-500">Net</p>
          <p className="text-lg font-semibold text-slate-800">{formatINR(income - expense)}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow p-4">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        {loading ? (
          <p className="text-slate-400 p-2">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-400 p-2">No transactions match these filters.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{t.category}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {t.description || '—'} · {t.date} · {t.payment_method}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-semibold ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatINR(t.amount)}
                  </span>
                  <button
                    onClick={() => setEditing(t)}
                    className="text-xs text-slate-500 hover:text-emerald-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {rows.length === 200 && (
          <p className="text-xs text-slate-400 mt-3">
            Showing the latest 200. Narrow the filters to see older ones.
          </p>
        )}
      </div>

      {/* Edit popup */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-md">
            <TransactionForm
              transaction={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                reload()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}