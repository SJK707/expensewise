export const EXPENSE_CATEGORIES = [
  'Food',
  'Travel',
  'Shopping',
  'Bills',
  'EMI',
  'Family',
  'Health',
  'Entertainment',
  'Education',
  'Other',
]

export const INCOME_CATEGORIES = [
  'Salary',
  'Government',
  'Freelance',
  'Gift',
  'Other',
]

export const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Net Banking']

// Today's date as YYYY-MM-DD in YOUR timezone.
// (toISOString() uses UTC, which can give yesterday's date in India after midnight.)
export function todayLocal() {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount))
}
// "2026-10" -> { start: "2026-10-01", end: "2026-11-01" }
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end }
}

// shiftMonth("2026-10", -1) -> "2026-09"
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "2026-10" -> "October 2026"
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}