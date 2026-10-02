import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TransactionForm from '../components/TransactionForm'
import { formatINR } from '../lib/constants'

export default function AddTransaction() {
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const loadRecent = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error) setRecent(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TransactionForm onSaved={loadRecent} />

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent transactions</h2>

        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="text-slate-400">Nothing yet. Add your first one!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{t.category}</p>
                  <p className="text-xs text-slate-500">
                    {t.description || '—'} · {t.date} · {t.payment_method}
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
    </div>
  )
}