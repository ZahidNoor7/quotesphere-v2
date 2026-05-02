/** Expense line-item categories — shared between the create and edit forms. */
export const EXPENSE_CATEGORIES = [
  "Materials",
  "Labour",
  "Transport",
  "Equipment",
  "Software",
  "Office",
  "Other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
