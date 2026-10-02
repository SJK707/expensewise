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