const toMonthKey = (month, year) => `${year}-${String(month).padStart(2, '0')}`

export function getExpectedRent(tenant, selectedMonth, selectedYear) {
  if (tenant.scheduled_increase) {
    const effectiveYM = tenant.scheduled_increase.effective_date.slice(0, 7)
    const selectedYM = toMonthKey(selectedMonth, selectedYear)

    if (effectiveYM <= selectedYM) {
      return tenant.scheduled_increase.new_rent_cents
    }
  }

  return tenant.current_rent_cents
}

export function getArrearsStatus(tenant, transactions, selectedMonth, selectedYear) {
  const expected = getExpectedRent(tenant, selectedMonth, selectedYear)
  const monthKey = toMonthKey(selectedMonth, selectedYear)

  const paid = transactions
    .filter(
      (transaction) =>
        transaction.tenant_id === tenant.id &&
        transaction.category_name === 'Rental Income' &&
        transaction.date.startsWith(monthKey),
    )
    .reduce((sum, transaction) => sum + transaction.amount_cents, 0)

  return {
    expected,
    paid,
    inArrears: paid < expected,
    isFullyPaid: paid >= expected,
    isPartial: paid > 0 && paid < expected,
    isMissing: paid === 0,
    shortfall: Math.max(0, expected - paid),
  }
}

export function computePAndL(transactions, selectedMonth, selectedYear) {
  const monthKey = toMonthKey(selectedMonth, selectedYear)
  const inMonth = transactions.filter((transaction) =>
    transaction.date.startsWith(monthKey),
  )

  const income = inMonth
    .filter((transaction) => transaction.transaction_type === 'Income')
    .reduce((sum, transaction) => sum + transaction.amount_cents, 0)

  const expenses = inMonth
    .filter((transaction) => transaction.transaction_type === 'PAndL')
    .reduce((sum, transaction) => sum + transaction.amount_cents, 0)

  const cashFlowOnly = inMonth
    .filter((transaction) => transaction.transaction_type === 'CashFlowOnly')
    .reduce((sum, transaction) => sum + transaction.amount_cents, 0)

  return {
    income,
    expenses,
    pandl: income - expenses,
    cashFlow: income - expenses - cashFlowOnly,
  }
}

export function splitMortgagePayment({
  date,
  property_id,
  total_payment_cents,
  interest_amount_cents,
  notes = '',
}) {
  if (interest_amount_cents > total_payment_cents) {
    throw new Error('Interest amount cannot be greater than total payment.')
  }

  const groupId = crypto.randomUUID()
  const principalAmountCents = total_payment_cents - interest_amount_cents

  return [
    {
      id: crypto.randomUUID(),
      group_id: groupId,
      date,
      property_id,
      unit_id: null,
      tenant_id: null,
      category_name: 'Mortgage Interest',
      amount_cents: interest_amount_cents,
      notes,
      transaction_type: 'PAndL',
    },
    {
      id: crypto.randomUUID(),
      group_id: groupId,
      date,
      property_id,
      unit_id: null,
      tenant_id: null,
      category_name: 'Mortgage Principal',
      amount_cents: principalAmountCents,
      notes,
      transaction_type: 'CashFlowOnly',
    },
  ]
}
