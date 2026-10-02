import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Checking connection...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('transactions').select('*')
      if (error) {
        setStatus('❌ ' + error.message)
      } else {
        setStatus(`✅ Connected! Rows visible: ${data.length}`)
      }
    }
    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-emerald-600">ExpenseWise</h1>
        <p className="mt-2 text-slate-600">{status}</p>
      </div>
    </div>
  )
}

export default App