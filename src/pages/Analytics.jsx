import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatINR, todayLocal, monthRange, shiftMonth, monthLabel } from '../lib/constants'

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#94a3b8',
]

const shortMonth = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short' })
}

const sumBy = (list, type) =>
  list.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0)

function expenseByCategory(list) {
  const acc = {}
  for (const r of list) {
    if (r.type === 'expense') acc[r.category] = (acc[r.category] || 0) + Number(r.amount)
  }
  return acc
}

const compact = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)

export default function Analytics() {
  const currentMonth = todayLocal().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // The 6 months ending at the selected month
  const months = [-5, -4, -3, -2, -1, 0].map((d) => shiftMonth(month, d))

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')

      const first = monthRange(shiftMonth(month, -5)).start
      const { end } = monthRange(month)

      const [txRes, goalRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('type, category, amount, description, date')
          .gte('date', first)
          .lt('date', end),
        supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
      ])

      if (ignore) return
      if (txRes.error || goalRes.error) {
        setError((txRes.error || goalRes.error).message)
      } else {
        setRows(txRes.data)
        setGoals(goalRes.data)
      }
      setLoading(false)
    }

    load()
    return () => {
      ignore = true
    }
  }, [month])

  // ---- Numbers -------------------------------------------------------
  const series = months.map((m) => {
    const list = rows.filter((r) => r.date.startsWith(m))
    return {
      key: m,
      label: shortMonth(m),
      Income: sumBy(list, 'income'),
      Expenses: sumBy(list, 'expense'),
      count: list.length,
    }
  })

  const cur = rows.filter((r) => r.date.startsWith(month))
  const prev = rows.filter((r) => r.date.startsWith(shiftMonth(month, -1)))

  const income = sumBy(cur, 'income')
  const expense = sumBy(cur, 'expense')
  const prevExpense = sumBy(prev, 'expense')
  const balance = income - expense

  const curCats = expenseByCategory(cur)
  const prevCats = expenseByCategory(prev)
  const pieData = Object.entries(curCats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // ---- Insights ------------------------------------------------------
  const insights = []

  if (income > 0) {
    if (balance >= 0) {
      insights.push({
        icon: '💰',
        text: `You're keeping ${Math.round((balance / income) * 100)}% of your income this month (${formatINR(balance)}).`,
      })
    } else {
      insights.push({
        icon: '⚠️',
        text: `You've spent ${formatINR(-balance)} more than you earned this month.`,
      })
    }
  }

  if (expense > 0 && prevExpense > 0) {
    const pct = Math.round(((expense - prevExpense) / prevExpense) * 100)
    if (pct > 0) {
      insights.push({ icon: '📈', text: `Total spending is up ${pct}% compared with last month.` })
    } else if (pct < 0) {
      insights.push({ icon: '📉', text: `Total spending is down ${-pct}% compared with last month.` })
    }
  }

  // Biggest category increase and decrease (ignores tiny changes)
  const changes = Object.keys({ ...curCats, ...prevCats })
    .map((cat) => {
      const now = curCats[cat] || 0
      const before = prevCats[cat] || 0
      return { cat, now, before, diff: now - before }
    })
    .filter((c) => c.before > 0 && Math.abs(c.diff) >= 100 && Math.abs(c.diff / c.before) >= 0.1)

  const biggestUp = [...changes].filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  const biggestDown = [...changes].filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]

  if (biggestUp) {
    insights.push({
      icon: '🔺',
      text: `You spent ${Math.round((biggestUp.diff / biggestUp.before) * 100)}% more on ${biggestUp.cat} than last month (${formatINR(biggestUp.before)} → ${formatINR(biggestUp.now)}).`,
    })
  }
  if (biggestDown) {
    insights.push({
      icon: '🔻',
      text: `Your ${biggestDown.cat} spending dropped by ${formatINR(-biggestDown.diff)} compared with last month.`,
    })
  }

  if (pieData.length > 0 && expense > 0) {
    insights.push({
      icon: '🏷️',
      text: `${pieData[0].name} is your biggest category: ${Math.round((pieData[0].value / expense) * 100)}% of this month's spending.`,
    })
  }

  const expenseRows = cur.filter((r) => r.type === 'expense')
  if (expenseRows.length > 0) {
    const big = expenseRows.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a))
    insights.push({
      icon: '🧾',
      text: `Your largest single expense was ${formatINR(big.amount)} on ${big.description || big.category} (${big.date}).`,
    })
  }

  if (expenseRows.length >= 7) {
    const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
    const totals = Array(7).fill(0)
    for (const r of expenseRows) {
      const [y, m, d] = r.date.split('-').map(Number)
      totals[new Date(y, m - 1, d).getDay()] += Number(r.amount)
    }
    const top = totals.indexOf(Math.max(...totals))
    insights.push({
      icon: '📅',
      text: `You spend the most on ${days[top]} (${formatINR(totals[top])} this month).`,
    })
  }

  // Goal projections: only when looking at the current month
  const recent = series.slice(-3).filter((s) => s.count > 0)
  const avgNet = recent.length
    ? recent.reduce((s, x) => s + (x.Income - x.Expenses), 0) / recent.length
    : 0

  if (month === currentMonth) {
    const open = goals.filter((g) => Number(g.current_amount) < Number(g.target_amount)).slice(0, 3)
    if (open.length > 0 && avgNet > 0) {
      for (const g of open) {
        const remaining = Number(g.target_amount) - Number(g.current_amount)
        const n = Math.ceil(remaining / avgNet)
        insights.push({
          icon: '🎯',
          text: `At your recent pace of about ${formatINR(avgNet)}/month, you'd reach ${g.name} in roughly ${n} month${n > 1 ? 's' : ''}.`,
        })
      }
    } else if (open.length > 0) {
      insights.push({
        icon: '🎯',
        text: 'Your recent months show no surplus, so goal timelines can’t be estimated yet.',
      })
    }
  }

  const hasData = rows.length > 0

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
        <h1 className="text-xl font-bold text-slate-800">Analytics · {monthLabel(month)}</h1>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month === currentMonth}
          className="px-3 py-2 rounded-lg bg-white shadow text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-center py-10">Loading...</p>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl shadow p-6 text-slate-400">
          No transactions in these 6 months.{' '}
          <Link to="/add" className="text-emerald-600 underline">
            Add some
          </Link>{' '}
          to see charts.
        </div>
      ) : (
        <>
          {/* Insights */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Insights</h2>
            {insights.length === 0 ? (
              <p className="text-slate-400 text-sm">
                Not enough data for this month yet. Insights appear as you add transactions.
              </p>
            ) : (
              <ul className="space-y-2">
                {insights.map((i, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-slate-700">
                    <span>{i.icon}</span>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 6-month trend */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Income vs. expenses (6 months)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} />
                  <YAxis tickFormatter={compact} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category donut */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-slate-800 mb-3">
              Where the money went · {monthLabel(month)}
            </h2>
            {pieData.length === 0 ? (
              <p className="text-slate-400 text-sm">No expenses this month.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatINR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="space-y-2">
                  {pieData.map((d, i) => (
                    <li key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {d.name}
                      </span>
                      <span className="text-slate-500">
                        {formatINR(d.value)} · {Math.round((d.value / expense) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}