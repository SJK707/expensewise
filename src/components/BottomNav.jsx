import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MAIN_TABS, MORE_LINKS } from '../lib/navItems'

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = MORE_LINKS.some((l) => pathname.startsWith(l.to))

  const tabClass = (active) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
      active ? 'text-emerald-600' : 'text-slate-500'
    }`

  return (
    <>
      {/* "More" sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-base ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                  }`
                }
              >
                <span className="text-xl">{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base text-slate-500 text-left"
            >
              <span className="text-xl">🚪</span>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)]">
        {MAIN_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => tabClass(isActive)}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} className={tabClass(moreActive)}>
          <span className="text-xl leading-none">⋯</span>
          More
        </button>
      </nav>
    </>
  )
}