import { Prisma } from '@prisma/client';

/**
 * Canonical definition of "spend": APPROVED/REIMBURSED expenses (by expense date) plus
 * APPROVED card transactions (by occurrence date). Declined transactions never count.
 * Department is the employee's *current* department. Amounts are cast to text so no float ever touches them.
 */
export const spendRows = (organisationId: string, from: Date, to: Date) => Prisma.sql`
  SELECT e."expenseDate"::date AS d, e.amount, e.category, e."employeeId", emp."departmentId", 'EXPENSE' AS source
  FROM "Expense" e JOIN "Employee" emp ON emp.id = e."employeeId"
  WHERE e."organisationId" = ${organisationId} AND e.status IN ('APPROVED','REIMBURSED')
    AND e."expenseDate" BETWEEN ${from} AND ${to}
  UNION ALL
  SELECT t."occurredAt"::date AS d, t.amount, t.category, t."employeeId", emp."departmentId", 'CARD' AS source
  FROM "Transaction" t JOIN "Employee" emp ON emp.id = t."employeeId"
  WHERE t."organisationId" = ${organisationId} AND t.status = 'APPROVED'
    AND t."occurredAt"::date BETWEEN ${from} AND ${to}`;
