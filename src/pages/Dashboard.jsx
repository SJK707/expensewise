import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [rowCount, setRowCount] = useState(null)

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase.from('transactions').select('id')
      setRowCount(error ? 'error: ' + error.message : data.length)
    }
    check()
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-emerald-600">Dashboard</h1>
        <p className="mt-2 text-slate-600">Logged in as {user?.email}</p>
        <p className="mt-1 text-slate-500">Your transactions: {rowCount ?? '...'}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2"
        >
          Log out
        </button>
      </div>
    </div>
  )
}