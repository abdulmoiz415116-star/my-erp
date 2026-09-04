import { BaseFirestoreService } from './base.service';
import { CreateEntityInput } from '@/types/common';
import {
  Customer,
  Supplier,
  Product,
  Category,
  Account,
  AccountCategory,
  InventoryMovement,
  SaleInvoice,
  PurchaseOrder,
  Expense,
  Payment,
  LedgerEntry,
  StockLedgerEntry,
  StockTransaction,
  StockTransactionType,
  JournalEntry,
  JournalLine,
  TrialBalanceRow,
  ProfitLossStatement,
} from '@/types/erp';

export type { StockLedgerEntry, JournalEntry, JournalLine, TrialBalanceRow, ProfitLossStatement };
import { AuditLogEntry } from '@/types/audit';
import { TenantUser } from '@/types/tenant';

export class CustomerService extends BaseFirestoreService<Customer> {
  constructor(tenantId: string) {
    super('customers', tenantId);
  }
}

export class SupplierService extends BaseFirestoreService<Supplier> {
  constructor(tenantId: string) {
    super('suppliers', tenantId);
  }
}

export class CategoryService extends BaseFirestoreService<Category> {
  constructor(tenantId: string) {
    super('categories', tenantId);
  }
}

export class ProductService extends BaseFirestoreService<Product> {
  constructor(tenantId: string) {
    super('products', tenantId);
  }
}

export class StockTransactionService extends BaseFirestoreService<StockTransaction> {
  constructor(tenantId: string) {
    super('stock_transactions', tenantId);
  }
}

export class SaleService extends BaseFirestoreService<SaleInvoice> {
  constructor(tenantId: string) {
    super('sales', tenantId);
  }
}

export class PurchaseService extends BaseFirestoreService<PurchaseOrder> {
  constructor(tenantId: string) {
    super('purchases', tenantId);
  }
}

export class ExpenseService extends BaseFirestoreService<Expense> {
  constructor(tenantId: string) {
    super('expenses', tenantId);
  }
}

export class AccountService extends BaseFirestoreService<Account> {
  constructor(tenantId: string) {
    super('accounts', tenantId);
  }
}

export class PaymentService extends BaseFirestoreService<Payment> {
  constructor(tenantId: string) {
    super('payments', tenantId);
  }
}

export class JournalEntryService extends BaseFirestoreService<JournalEntry> {
  constructor(tenantId: string) {
    super('journal_entries', tenantId);
  }

  async createEntry(input: CreateEntityInput<JournalEntry>, userId = 'system'): Promise<JournalEntry> {
    const sumDebits = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const sumCredits = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
    const diff = Math.abs(sumDebits - sumCredits);
    if (diff > 0.01) {
      throw new Error(
        `Double-entry equilibrium violation: Total Debits ($${sumDebits.toFixed(2)}) must equal Total Credits ($${sumCredits.toFixed(2)}). Difference: $${diff.toFixed(2)}`
      );
    }

    return this.create({
      ...input,
      totalDebit: sumDebits,
      totalCredit: sumCredits,
      isBalanced: true,
      status: input.status || 'posted',
    }, userId);
  }

  async reverseEntry(entryId: string, reason: string, userId = 'system'): Promise<JournalEntry> {
    const original = await this.getById(entryId);
    if (!original) throw new Error('Original journal entry not found.');
    if (original.status === 'void') throw new Error('Journal entry has already been voided / reversed.');

    // Create inverted lines
    const reversalLines: JournalLine[] = original.lines.map((line, idx) => ({
      id: `rev-${line.id}-${idx}`,
      accountId: line.accountId,
      accountNumber: line.accountNumber,
      accountName: line.accountName,
      accountType: line.accountType,
      debit: line.credit, // Debit becomes Credit
      credit: line.debit, // Credit becomes Debit
      description: `Reversal: ${line.description || original.entryNumber}`,
    }));

    const reversalNumber = `REV-${original.entryNumber}`;
    const reversalEntry = await this.create({
      entryNumber: reversalNumber,
      date: new Date().toISOString(),
      reference: original.reference,
      description: `Reversal Entry: ${original.description}`,
      lines: reversalLines,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      isBalanced: true,
      sourceModule: 'cancellation',
      sourceId: original.id,
      sourceNumber: original.entryNumber,
      status: 'posted',
      reversalOfEntryId: original.id,
      reversalReason: reason,
      userId,
    }, userId);

    // Mark original as void/reversed
    await this.update(original.id, {
      status: 'void',
      reversedByEntryId: reversalEntry.id,
      reversalReason: reason,
    });

    return reversalEntry;
  }
}

export class InventoryService extends BaseFirestoreService<InventoryMovement> {
  constructor(tenantId: string) {
    super('inventory', tenantId);
  }
}

export class AuditLogService extends BaseFirestoreService<AuditLogEntry> {
  constructor(tenantId: string) {
    super('audit_logs', tenantId);
  }
}

export class TenantUserService extends BaseFirestoreService<TenantUser> {
  constructor(tenantId: string) {
    super('users', tenantId);
  }
}

/**
 * TRANSACTION-BASED STOCK INVARIANTS:
 * Current stock must NEVER be arbitrarily overwritten.
 * Stock changes only through valid transactions (purchases, sales, returns, adjustments).
 */

export function calculateProductCurrentStock(
  product: Product,
  transactions: StockTransaction[]
): number {
  const prodTransactions = transactions.filter(
    (t) => t.productId === product.id && !t.isDeleted && t.status !== 'inactive'
  );

  let stock = 0;
  prodTransactions.forEach((t) => {
    if (t.direction === 'in') {
      stock += t.quantity;
    } else if (t.direction === 'out') {
      stock -= t.quantity;
    }
  });

  return stock;
}

export function validateStockDeduction(
  productName: string,
  currentStock: number,
  deductionQty: number,
  allowNegativeStock: boolean = false
): { isValid: boolean; error?: string } {
  if (deductionQty <= 0) {
    return { isValid: false, error: 'Transaction quantity must be greater than zero.' };
  }
  if (!allowNegativeStock && currentStock - deductionQty < 0) {
    return {
      isValid: false,
      error: `Insufficient stock for "${productName}". Available: ${currentStock}, Requested deduction: ${deductionQty}. Negative inventory is disabled.`,
    };
  }
  return { isValid: true };
}

export function generateProductStockLedger(
  product: Product,
  transactions: StockTransaction[]
): StockLedgerEntry[] {
  const prodTransactions = transactions
    .filter((t) => t.productId === product.id && !t.isDeleted && t.status !== 'inactive')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  return prodTransactions.map((t) => {
    if (t.direction === 'in') {
      running += t.quantity;
    } else {
      running -= t.quantity;
    }
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      direction: t.direction,
      reference: t.reference,
      referenceType: t.referenceType,
      quantity: t.quantity,
      cost: t.cost,
      totalCost: t.totalCost,
      userName: t.userName,
      notes: t.notes,
      runningStock: running,
    };
  });
}

/**
 * TRANSACTION-DERIVED BALANCE INVARIANTS:
 * Customer & Supplier balances must NEVER be manually edited to fake a balance.
 * Balances must always be calculated dynamically from valid transactions.
 */

export function calculateCustomerCurrentBalance(
  customer: Customer,
  sales: SaleInvoice[],
  payments: Payment[]
): number {
  const opening = customer.openingBalance || 0;
  // Draft and void sales must NEVER affect customer receivables
  const customerSales = sales.filter(
    (s) =>
      s.customerId === customer.id &&
      !s.isDeleted &&
      s.status !== 'inactive' &&
      s.saleStatus !== 'draft' &&
      s.saleStatus !== 'void'
  );
  const customerReceipts = payments.filter((p) => p.partyId === customer.id && p.partyType === 'customer' && !p.isDeleted);

  const totalSalesAmount = customerSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalReceiptsAmount = customerReceipts.reduce((sum, p) => sum + (p.amount || 0), 0);

  return opening + totalSalesAmount - totalReceiptsAmount;
}

export function calculateSupplierCurrentBalance(
  supplier: Supplier,
  purchases: PurchaseOrder[],
  payments: Payment[]
): number {
  const opening = supplier.openingBalance || 0;
  const supplierPurchases = purchases.filter(
    (p) =>
      p.supplierId === supplier.id &&
      !p.isDeleted &&
      p.status !== 'inactive' &&
      p.purchaseStatus !== 'draft' &&
      p.purchaseStatus !== 'void'
  );
  const supplierDisbursements = payments.filter((p) => p.partyId === supplier.id && p.partyType === 'supplier' && !p.isDeleted);

  const totalPurchasesAmount = supplierPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalPaidAmount = supplierDisbursements.reduce((sum, p) => sum + (p.amount || 0), 0);

  return opening + totalPurchasesAmount - totalPaidAmount;
}

export function generateCustomerLedger(
  customer: Customer,
  sales: SaleInvoice[],
  payments: Payment[]
): LedgerEntry[] {
  const entries: Array<{
    id: string;
    date: string;
    type: 'opening' | 'invoice' | 'purchase' | 'payment';
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  // 1. Opening Balance
  if ((customer.openingBalance || 0) !== 0) {
    entries.push({
      id: `open-${customer.id}`,
      date: customer.createdAt,
      type: 'opening',
      reference: 'OPENING',
      description: 'Opening Balance brought forward',
      debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
      credit: customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0,
    });
  }

  // 2. Sales Invoices (Debits to Accounts Receivable - excludes draft and void)
  const custSales = sales.filter(
    (s) =>
      s.customerId === customer.id &&
      !s.isDeleted &&
      s.saleStatus !== 'draft' &&
      s.saleStatus !== 'void'
  );
  custSales.forEach((s) => {
    const isReturned = s.saleStatus === 'returned';
    entries.push({
      id: s.id,
      date: s.date,
      type: 'invoice',
      reference: s.invoiceNumber,
      description: isReturned
        ? `Sales Invoice (Returned/Adjusted) - ${s.items.length} item(s)`
        : `Sales Invoice - ${s.items.length} line item(s)`,
      debit: s.totalAmount || 0,
      credit: 0,
    });
  });

  // 3. Customer Receipts (Credits reducing Accounts Receivable)
  const custPayments = payments.filter((p) => p.partyId === customer.id && p.partyType === 'customer' && !p.isDeleted);
  custPayments.forEach((p) => {
    entries.push({
      id: p.id,
      date: p.date,
      type: 'payment',
      reference: p.paymentNumber,
      description: `Payment Received via ${p.paymentMethod.replace('_', ' ')} (${p.accountName})`,
      debit: 0,
      credit: p.amount || 0,
    });
  });

  // Sort chronological
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative running balance
  let running = 0;
  return entries.map((e) => {
    running += e.debit - e.credit;
    return {
      ...e,
      runningBalance: running,
    };
  });
}

export function generateSupplierLedger(
  supplier: Supplier,
  purchases: PurchaseOrder[],
  payments: Payment[]
): LedgerEntry[] {
  const entries: Array<{
    id: string;
    date: string;
    type: 'opening' | 'invoice' | 'purchase' | 'payment';
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  // 1. Opening Balance
  if ((supplier.openingBalance || 0) !== 0) {
    entries.push({
      id: `open-${supplier.id}`,
      date: supplier.createdAt,
      type: 'opening',
      reference: 'OPENING',
      description: 'Opening Balance brought forward',
      debit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0,
      credit: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
    });
  }

  // 2. Purchase Orders (Credits to Accounts Payable - money owed)
  const suppPurchases = purchases.filter(
    (p) =>
      p.supplierId === supplier.id &&
      !p.isDeleted &&
      p.purchaseStatus !== 'draft' &&
      p.purchaseStatus !== 'void'
  );
  suppPurchases.forEach((p) => {
    const isReturned = p.purchaseStatus === 'returned';
    entries.push({
      id: p.id,
      date: p.date,
      type: 'purchase',
      reference: p.poNumber,
      description: isReturned
        ? `Purchase Order (Returned/Debit Note) - ${p.items.length} item(s)`
        : `Purchase Order - ${p.items.length} line item(s)`,
      debit: 0,
      credit: p.totalAmount || 0,
    });
  });

  // 3. Supplier Payments (Debits reducing Accounts Payable)
  const suppPayments = payments.filter((p) => p.partyId === supplier.id && p.partyType === 'supplier' && !p.isDeleted);
  suppPayments.forEach((p) => {
    entries.push({
      id: p.id,
      date: p.date,
      type: 'payment',
      reference: p.paymentNumber,
      description: `Payment Disbursed via ${p.paymentMethod.replace('_', ' ')} (${p.accountName})`,
      debit: p.amount || 0,
      credit: 0,
    });
  });

  // Sort chronological
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative running balance (owed to supplier)
  let running = 0;
  return entries.map((e) => {
    running += e.credit - e.debit;
    return {
      ...e,
      runningBalance: running,
    };
  });
}

export interface AccountLedgerEntry {
  id: string;
  date: string;
  type:
    | 'opening'
    | 'deposit'
    | 'withdrawal'
    | 'transfer_in'
    | 'transfer_out'
    | 'customer_receipt'
    | 'supplier_payment'
    | 'expense'
    | 'refund';
  reference: string;
  description: string;
  inflow: number;
  outflow: number;
  runningBalance: number;
}

export function generateAccountLedger(
  account: Account,
  payments: Payment[],
  expenses: Expense[]
): AccountLedgerEntry[] {
  const entries: Array<{
    id: string;
    date: string;
    type: AccountLedgerEntry['type'];
    reference: string;
    description: string;
    inflow: number;
    outflow: number;
  }> = [];

  // 1. Opening Balance
  if ((account.openingBalance || 0) !== 0) {
    entries.push({
      id: `open-${account.id}`,
      date: account.createdAt,
      type: 'opening',
      reference: 'OPENING',
      description: 'Initial Opening Balance',
      inflow: (account.openingBalance || 0) > 0 ? account.openingBalance! : 0,
      outflow: (account.openingBalance || 0) < 0 ? Math.abs(account.openingBalance!) : 0,
    });
  }

  // 2. Payments (Receipts, Disbursements, Transfers, Direct Deposits, Direct Withdrawals)
  const relevantPayments = payments.filter(
    (p) => !p.isDeleted && (p.accountId === account.id || p.destinationAccountId === account.id)
  );

  relevantPayments.forEach((p) => {
    if (p.partyType === 'internal_transfer') {
      if (p.destinationAccountId === account.id) {
        // Inflow transfer
        entries.push({
          id: `${p.id}-in`,
          date: p.date,
          type: 'transfer_in',
          reference: p.paymentNumber,
          description: `Transfer In from ${p.accountName}${p.notes ? `: ${p.notes}` : ''}`,
          inflow: p.amount || 0,
          outflow: 0,
        });
      } else if (p.accountId === account.id) {
        // Outflow transfer
        entries.push({
          id: `${p.id}-out`,
          date: p.date,
          type: 'transfer_out',
          reference: p.paymentNumber,
          description: `Transfer Out to ${p.destinationAccountName || 'Account'}${p.notes ? `: ${p.notes}` : ''}`,
          inflow: 0,
          outflow: p.amount || 0,
        });
      }
    } else if (p.partyType === 'direct_deposit') {
      entries.push({
        id: p.id,
        date: p.date,
        type: 'deposit',
        reference: p.paymentNumber,
        description: `Direct Cash/Bank Deposit: ${p.notes || p.reference || 'Funds Inward'}`,
        inflow: p.amount || 0,
        outflow: 0,
      });
    } else if (p.partyType === 'direct_withdrawal') {
      entries.push({
        id: p.id,
        date: p.date,
        type: 'withdrawal',
        reference: p.paymentNumber,
        description: `Cash/Bank Withdrawal: ${p.notes || p.reference || 'Funds Outward'}`,
        inflow: 0,
        outflow: p.amount || 0,
      });
    } else if (p.partyType === 'customer') {
      if (p.type === 'receipt') {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'customer_receipt',
          reference: p.paymentNumber,
          description: `Customer Receipt - ${p.partyName}${p.invoiceNumber ? ` (Inv #${p.invoiceNumber})` : ''}`,
          inflow: p.amount || 0,
          outflow: 0,
        });
      } else {
        // Customer refund payment
        entries.push({
          id: p.id,
          date: p.date,
          type: 'refund',
          reference: p.paymentNumber,
          description: `Customer Refund - ${p.partyName}`,
          inflow: 0,
          outflow: p.amount || 0,
        });
      }
    } else if (p.partyType === 'supplier') {
      if (p.type === 'payment') {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'supplier_payment',
          reference: p.paymentNumber,
          description: `Supplier Payment - ${p.partyName}${p.purchaseOrderNumber ? ` (PO #${p.purchaseOrderNumber})` : ''}`,
          inflow: 0,
          outflow: p.amount || 0,
        });
      } else {
        // Supplier refund receipt
        entries.push({
          id: p.id,
          date: p.date,
          type: 'refund',
          reference: p.paymentNumber,
          description: `Supplier Refund - ${p.partyName}`,
          inflow: p.amount || 0,
          outflow: 0,
        });
      }
    }
  });

  // 3. Operating Expenses
  const relevantExpenses = expenses.filter(
    (e) => !e.isDeleted && e.accountId === account.id && e.expenseStatus !== 'void' && e.expenseStatus !== 'draft'
  );
  relevantExpenses.forEach((e) => {
    entries.push({
      id: e.id,
      date: e.date,
      type: 'expense',
      reference: e.expenseNumber,
      description: `Operating Expense: ${e.category} - ${e.description}${e.vendor ? ` (Payee: ${e.vendor})` : ''}`,
      inflow: 0,
      outflow: e.totalAmount || 0,
    });
  });

  // Sort chronologically
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running balance
  let running = 0;
  return entries.map((e) => {
    running += e.inflow - e.outflow;
    return {
      ...e,
      runningBalance: running,
    };
  });
}

/**
 * DOUBLE-ENTRY ACCOUNTING ENGINE:
 * 1. Trial Balance Computation in Mathematical Equilibrium (Debits = Credits)
 */
export function computeTrialBalance(
  journalEntries: JournalEntry[],
  accounts: Account[]
): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isEquilibrium: boolean;
} {
  // Accumulate debit and credit totals per account from valid posted journal lines
  const accountSums: Record<string, { debits: number; credits: number }> = {};

  // Initialize all accounts with zero
  accounts.forEach((acc) => {
    accountSums[acc.id] = { debits: 0, credits: 0 };
  });

  const validEntries = journalEntries.filter((je) => !je.isDeleted && je.status !== 'void');

  validEntries.forEach((je) => {
    je.lines.forEach((line) => {
      if (!accountSums[line.accountId]) {
        accountSums[line.accountId] = { debits: 0, credits: 0 };
      }
      accountSums[line.accountId].debits += line.debit || 0;
      accountSums[line.accountId].credits += line.credit || 0;
    });
  });

  let grandDebit = 0;
  let grandCredit = 0;

  const rows: TrialBalanceRow[] = accounts
    .filter((acc) => !acc.isDeleted)
    .map((acc) => {
      const sums = accountSums[acc.id] || { debits: 0, credits: 0 };
      const normal = acc.normalBalance || (acc.accountCategory === 'liability' || acc.accountCategory === 'equity' || acc.accountCategory === 'revenue' ? 'credit' : 'debit');
      
      // Determine net column balance
      const rawNet = normal === 'debit' ? (sums.debits - sums.credits) : (sums.credits - sums.debits);
      const isPositive = rawNet >= 0;

      let debitCol = 0;
      let creditCol = 0;

      if (normal === 'debit') {
        if (isPositive) {
          debitCol = rawNet;
        } else {
          creditCol = Math.abs(rawNet);
        }
      } else {
        if (isPositive) {
          creditCol = rawNet;
        } else {
          debitCol = Math.abs(rawNet);
        }
      }

      grandDebit += debitCol;
      grandCredit += creditCol;

      return {
        accountId: acc.id,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        accountCategory: acc.accountCategory || 'asset',
        accountType: acc.type,
        normalBalance: normal,
        debitBalance: debitCol,
        creditBalance: creditCol,
        netBalance: rawNet,
      };
    })
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  const diff = Math.abs(grandDebit - grandCredit);

  return {
    rows,
    totalDebit: grandDebit,
    totalCredit: grandCredit,
    isEquilibrium: diff < 0.05,
  };
}

/**
 * 2. General Ledger by Account
 */
export interface GeneralLedgerEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export function computeGeneralLedger(
  journalEntries: JournalEntry[],
  account: Account
): GeneralLedgerEntry[] {
  const lines: Array<{
    id: string;
    entryNumber: string;
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  const validEntries = journalEntries
    .filter((je) => !je.isDeleted && je.status !== 'void')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  validEntries.forEach((je) => {
    je.lines.forEach((l) => {
      if (l.accountId === account.id) {
        lines.push({
          id: `${je.id}-${l.id}`,
          entryNumber: je.entryNumber,
          date: je.date,
          reference: je.reference,
          description: l.description || je.description,
          debit: l.debit || 0,
          credit: l.credit || 0,
        });
      }
    });
  });

  const normal = account.normalBalance || (account.accountCategory === 'liability' || account.accountCategory === 'equity' || account.accountCategory === 'revenue' ? 'credit' : 'debit');

  let running = account.openingBalance || 0;
  return lines.map((entry) => {
    if (normal === 'debit') {
      running += entry.debit - entry.credit;
    } else {
      running += entry.credit - entry.debit;
    }
    return {
      ...entry,
      runningBalance: running,
    };
  });
}

/**
 * 3. Profit & Loss Statement (Guaranteed COGS, NEVER Sales - Purchases)
 */
export function computeProfitAndLossStatement(
  sales: SaleInvoice[],
  expenses: Expense[],
  period: string = 'all'
): ProfitLossStatement {
  const validSales = sales.filter(
    (s) => !s.isDeleted && s.saleStatus !== 'draft' && s.saleStatus !== 'void'
  );

  const returnedSales = validSales.filter((s) => s.saleStatus === 'returned');
  const normalSales = validSales.filter((s) => s.saleStatus !== 'returned');

  const grossSales = normalSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const salesReturns = returnedSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const netSales = grossSales - salesReturns;

  // Actual Cost of Goods Sold (COGS) based on sold products acquisition cost
  let cogsTotal = 0;
  normalSales.forEach((s) => {
    s.items?.forEach((it) => {
      cogsTotal += (it.costPrice || 0) * (it.quantity || 0);
    });
  });

  // Subtract returned goods cost from COGS
  returnedSales.forEach((s) => {
    s.items?.forEach((it) => {
      cogsTotal -= (it.costPrice || 0) * (it.quantity || 0);
    });
  });
  cogsTotal = Math.max(0, cogsTotal);

  // Gross Profit = Net Sales - COGS
  const grossProfit = netSales - cogsTotal;
  const grossMarginPercent = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';

  // Operating Expenses (excludes draft and void)
  const validExpenses = expenses.filter(
    (e) => !e.isDeleted && e.expenseStatus !== 'draft' && e.expenseStatus !== 'void'
  );

  const categoryMap: Record<string, number> = {};
  validExpenses.forEach((e) => {
    const cat = e.category || 'General Operations';
    categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
  });

  const categorizedExpenses = Object.entries(categoryMap).map(([category, amount]) => ({
    category,
    amount,
  }));

  const totalOperatingExpenses = validExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Net Operating Profit = Gross Profit - Operating Expenses
  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netMarginPercent = netSales > 0 ? ((netOperatingProfit / netSales) * 100).toFixed(1) : '0.0';

  return {
    grossSales,
    salesReturns,
    netSales,
    cogsTotal,
    grossProfit,
    grossMarginPercent,
    categorizedExpenses,
    totalOperatingExpenses,
    netOperatingProfit,
    netMarginPercent,
    period,
  };
}

