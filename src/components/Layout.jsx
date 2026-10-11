import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="max-w-4xl mx-auto p-4 pb-28 md:pb-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}