import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatINR, todayLocal, monthRange, shiftMonth, monthLabel } from '../lib/constants'

export default function Dashboard() {
  const currentMonth = todayLocal().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState([]) // this month + previous month
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')

      // One query covering the previous month AND this month
      const prevStart = monthRange(shiftMonth(month, -1)).start
      const { end } = monthRange(month)

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', prevStart)
        .lt('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (ignore) return
      if (error) setError(error.message)
      else setRows(data)
      setLoading(false)
    }

    load()
    return () => {
      ignore = true
    }
  }, [month])

  // Split into this month and last month
  const { start } = monthRange(month)
  const thisMonth = rows.filter((r) => r.date >= start)
  const lastMonth = rows.filter((r) => r.date < start)

  const sum = (list, type) =>
    list.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0)

  const income = sum(thisMonth, 'income')
  const expense = sum(thisMonth, 'expense')
  const balance = income - expense
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : null

  const lastExpense = sum(lastMonth, 'expense')
  const expenseDiff = expense - lastExpense

  // Average daily spend
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const isCurrent = month === currentMonth
  const daysElapsed = isCurrent ? Number(todayLocal().slice(8, 10)) : daysInMonth
  const dailyAvg = expense / daysElapsed

  // Spending by category, biggest first
  const byCategory = Object.entries(
    thisMonth
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + Number(r.amount)
        return acc
      }, {})
  ).sort((a, b) => b[1] - a[1])

  const recent = thisMonth.slice(0, 5)

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
        <h1 className="text-xl font-bold text-slate-800">{monthLabel(month)}</h1>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrent}
          className="px-3 py-2 rounded-lg bg-white shadow text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Income</p>
              <p className="text-xl font-semibold text-emerald-600">{formatINR(income)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Expenses</p>
              <p className="text-xl font-semibold text-red-500">{formatINR(expense)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Balance</p>
              <p
                className={`text-xl font-semibold ${
                  balance < 0 ? 'text-red-500' : 'text-slate-800'
                }`}
              >
                {formatINR(balance)}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Savings rate</p>
              <p className="text-xl font-semibold text-slate-800">
                {savingsRate === null ? '—' : `${savingsRate}%`}
              </p>
            </div>
          </div>

          {/* Quick insights */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Average spend per day</p>
              <p className="text-lg font-semibold text-slate-800">{formatINR(dailyAvg)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500">Compared to last month</p>
              {lastExpense === 0 ? (
                <p className="text-sm text-slate-400 mt-1">No expenses last month to compare.</p>
              ) : (
                <p
                  className={`text-lg font-semibold ${
                    expenseDiff > 0 ? 'text-red-500' : 'text-emerald-600'
                  }`}
                >
                  {expenseDiff > 0 ? '▲' : '▼'} {formatINR(Math.abs(expenseDiff))}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    {expenseDiff > 0 ? 'more' : 'less'} spent
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Spending by category */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Spending by category</h2>
            {byCategory.length === 0 ? (
              <p className="text-slate-400">
                No expenses this month.{' '}
                <Link to="/add" className="text-emerald-600 underline">
                  Add one
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map(([cat, amt]) => {
                  const pct = expense > 0 ? (amt / expense) * 100 : 0
                  return (
                    <li key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{cat}</span>
                        <span className="text-slate-500">
                          {formatINR(amt)} · {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Latest transactions */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800">Latest transactions</h2>
              <Link to="/transactions" className="text-sm text-emerald-600 hover:underline">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-slate-400">Nothing this month yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{t.category}</p>
                      <p className="text-xs text-slate-500">
                        {t.description || '—'} · {t.date}
                      </p>
                    </div>
                    <span
                      className={`font-semibold ${
                        t.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {formatINR(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Floating add button */}
          <Link
            to="/add"
            className="fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-full shadow-lg px-5 py-3"
          >
            + Add
          </Link>
        </>
      )}
    </div>
  )
}