import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive
      ? 'bg-emerald-100 text-emerald-700'
      : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-emerald-600">ExpenseWise</span>

        <div className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={linkClass}>
           History
          </NavLink>
          <NavLink to="/add" className={linkClass}>
            Add
          </NavLink>
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}