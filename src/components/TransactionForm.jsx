import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  todayLocal,
} from '../lib/constants'

export default function TransactionForm({ onSaved }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const handleTypeChange = (newType) => {
    setType(newType)
    // Reset category so an expense category isn't kept on an income entry
    setCategory(newType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }

    setSaving(true)

    // user_id is filled in automatically by the database (auth.uid())
    const { error } = await supabase.from('transactions').insert({
      amount: value,
      type,
      category,
      description: description.trim() || null,
      date,
      payment_method: paymentMethod,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Transaction saved ✅')
    setAmount('')
    setDescription('')
    onSaved?.()
  }

  const inputClass =
    'w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Add Transaction</h2>

      {/* Expense / Income toggle */}
      <div className="grid grid-cols-2 gap-2">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`py-2 rounded-lg font-medium capitalize transition ${
              type === t
                ? t === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        <label className={labelClass}>Amount (₹)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          placeholder="250"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={inputClass}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description (optional)</label>
        <input
          type="text"
          placeholder="Lunch"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg py-2 transition"
      >
        {saving ? 'Saving...' : 'Add Transaction'}
      </button>
    </form>
  )
}