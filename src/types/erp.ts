import { BaseEntity } from './common';

export interface Customer extends BaseEntity {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  companyName?: string;
  taxNumber?: string;
  openingBalance: number;
  creditLimit: number;
  currentBalance: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  notes?: string;
}

export interface Supplier extends BaseEntity {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  companyName: string;
  taxNumber?: string;
  openingBalance: number;
  creditLimit: number;
  currentBalance: number;
  paymentTermsDays: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  notes?: string;
}

export interface Product extends BaseEntity {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  unit: string; // 'pcs', 'kg', 'box', etc.
  costPrice: number;
  sellingPrice: number;
  taxRate: number; // Percentage, e.g. 15
  currentStock: number;
  minStockAlert: number;
  maxStockLevel?: number;
  description?: string;
  imageUrl?: string;
}

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs';

export interface Account extends BaseEntity {
  accountNumber: string;
  accountName: string;
  type: 'cash' | 'bank' | 'accounts_receivable' | 'accounts_payable' | 'income' | 'expense' | 'equity' | 'inventory' | 'cogs' | 'liability';
  accountCategory?: AccountCategory;
  normalBalance?: 'debit' | 'credit';
  currency: string;
  currentBalance: number;
  openingBalance?: number;
  bankName?: string;
  bankBranch?: string;
  isDefault: boolean;
  description?: string;
}

export interface Category extends BaseEntity {
  name: string;
  code: string;
  description?: string;
}

export type StockTransactionType =
  | 'purchase'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'transfer'
  | 'initial_stock';

export type StockDirection = 'in' | 'out';

export interface StockTransaction extends BaseEntity {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  direction: StockDirection;
  type: StockTransactionType;
  reference: string;
  referenceType: 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'stock_adjustment' | 'transfer' | 'initial';
  date: string;
  cost: number;
  totalCost: number;
  userId: string;
  userName: string;
  location?: string;
  notes?: string;
}

export interface InventoryMovement extends BaseEntity {
  productId: string;
  productName: string;
  sku: string;
  type: 'inward' | 'outward' | 'adjustment' | 'transfer';
  quantity: number;
  unitCost: number;
  referenceType: 'purchase' | 'sale' | 'manual_adjustment';
  referenceId?: string;
  notes?: string;
}

export type SaleStatus = 'draft' | 'posted' | 'void' | 'returned';
export type SaleType = 'cash' | 'credit' | 'partial';

export interface SaleInvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  discountPercent?: number;
  discountAmount?: number;
  subtotal: number;
  total: number;
  returnedQuantity?: number;
}

export interface SaleInvoice extends BaseEntity {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string; // ISO string
  dueDate?: string;
  items: SaleInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  saleStatus?: SaleStatus; // Defaults to 'posted' for existing records
  saleType?: SaleType;     // 'cash' | 'credit' | 'partial'
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'cheque';
  accountId?: string;
  accountName?: string;
  voidReason?: string;
  voidDate?: string;
  returnReason?: string;
  returnDate?: string;
  notes?: string;
}

export type PurchaseStatus = 'draft' | 'received' | 'void' | 'returned';
export type PurchaseType = 'cash' | 'bank' | 'credit' | 'partial';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  discountPercent?: number;
  discountAmount?: number;
  subtotal: number;
  total: number;
  returnedQuantity?: number;
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  discountAmount?: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  receiptStatus: 'received' | 'partial' | 'pending';
  purchaseStatus?: PurchaseStatus; // 'draft' | 'received' | 'void' | 'returned'
  purchaseType?: PurchaseType;     // 'cash' | 'bank' | 'credit' | 'partial'
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'cheque';
  accountId?: string;
  accountName?: string;
  voidReason?: string;
  voidDate?: string;
  returnReason?: string;
  returnDate?: string;
  notes?: string;
}

export type ExpenseStatus = 'draft' | 'posted' | 'void';

export interface Expense extends BaseEntity {
  expenseNumber: string;
  category: string;
  categoryId?: string;
  date: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  accountId: string;
  accountName: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'credit_card' | 'cheque';
  vendor?: string;
  description: string;
  reference?: string;
  notes?: string;
  expenseStatus?: ExpenseStatus;
  voidReason?: string;
  voidDate?: string;
}

export type PaymentPartyType = 'customer' | 'supplier' | 'internal_transfer' | 'direct_deposit' | 'direct_withdrawal';
export type PaymentTransactionType = 'receipt' | 'payment' | 'transfer'; // receipt from customer, payment to supplier, or internal transfer

export interface Payment extends BaseEntity {
  paymentNumber: string;
  partyType: PaymentPartyType;
  partyId: string;
  partyName: string;
  type: PaymentTransactionType;
  amount: number;
  date: string;
  accountId: string;
  accountName: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'credit_card' | 'cheque';
  reference?: string;
  notes?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'opening' | 'invoice' | 'purchase' | 'payment';
  reference: string;
  description: string;
  debit: number; // Increases customer receivable / Decreases supplier payable
  credit: number; // Decreases customer receivable / Increases supplier payable
  runningBalance: number;
}

export interface StockLedgerEntry {
  id: string;
  date: string;
  type: StockTransactionType;
  direction: 'in' | 'out';
  reference: string;
  referenceType: string;
  quantity: number;
  cost: number;
  totalCost: number;
  userName: string;
  notes?: string;
  runningStock: number;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  description?: string;
}

export type JournalSourceModule =
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'payments'
  | 'inventory'
  | 'transfer'
  | 'manual'
  | 'cancellation'
  | 'return';

export interface JournalEntry extends BaseEntity {
  entryNumber: string;       // e.g. "JE-10001"
  date: string;              // ISO date
  reference: string;          // e.g. "INV-1001", "PO-2001", "EXP-3001"
  description: string;        // e.g. "Commercial Sale to Vanguard Aerospace"
  lines: JournalLine[];      // Balanced debit and credit lines
  totalDebit: number;        // Sum of all line debits
  totalCredit: number;       // Sum of all line credits (MUST EQUAL totalDebit)
  isBalanced: boolean;       // totalDebit === totalCredit
  sourceModule: JournalSourceModule;
  sourceId?: string;         // Document ID
  sourceNumber?: string;     // Document number
  userId?: string;
  userName?: string;
  status: 'posted' | 'void';
  reversalOfEntryId?: string;
  reversedByEntryId?: string;
  reversalReason?: string;
  notes?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountType: string;
  normalBalance: 'debit' | 'credit';
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

export interface ProfitLossStatement {
  grossSales: number;
  salesReturns: number;
  netSales: number;
  cogsTotal: number;
  grossProfit: number;
  grossMarginPercent: string;
  categorizedExpenses: Array<{ category: string; amount: number }>;
  totalOperatingExpenses: number;
  netOperatingProfit: number;
  netMarginPercent: string;
  period: string;
}


