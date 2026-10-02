import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="bg-white rounded-2xl shadow p-8 text-center">
      <h1 className="text-2xl font-bold text-emerald-600">Dashboard</h1>
      <p className="mt-2 text-slate-600">Logged in as {user?.email}</p>
      <p className="mt-1 text-slate-400">Real numbers and charts arrive in Phase 6.</p>
    </div>
  )
}