// Links shown in the top bar on desktop
export const DESKTOP_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'History' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/goals', label: 'Goals' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/add', label: 'Add' },
]

// Bottom tab bar on phones
export const MAIN_TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/transactions', label: 'History', icon: '🧾' },
  { to: '/add', label: 'Add', icon: '➕' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
]

// Inside the "More" sheet on phones
export const MORE_LINKS = [
  { to: '/budgets', label: 'Budgets', icon: '🎯' },
  { to: '/goals', label: 'Goals', icon: '🏦' },
  { to: '/recurring', label: 'Recurring', icon: '🔁' },
]