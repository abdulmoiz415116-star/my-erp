/**
 * Enterprise Auto-Incrementing Sequence & Serial Number Generator
 * Ensures sequential, collision-free document and entity codes across the ERP.
 */

export function generateNextCode(
  prefix: string,
  existingCodes: (string | undefined | null)[],
  startingNumber = 1001,
  padLength = 4
): string {
  let maxNumber = 0;
  const cleanPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const exactRegex = new RegExp(`^${cleanPrefix}(\\d+)$`, 'i');
  const trailingDigitsRegex = /(\\d+)$/;

  for (const raw of existingCodes) {
    if (!raw) continue;
    const code = String(raw).trim();
    
    // First try matching prefix + number exactly
    const exactMatch = code.match(exactRegex);
    if (exactMatch && exactMatch[1]) {
      const val = parseInt(exactMatch[1], 10);
      if (!isNaN(val) && val > maxNumber) {
        maxNumber = val;
      }
      continue;
    }

    // Fallback: match any trailing digits
    const trailMatch = code.match(trailingDigitsRegex);
    if (trailMatch && trailMatch[1]) {
      const val = parseInt(trailMatch[1], 10);
      if (!isNaN(val) && val > maxNumber) {
        maxNumber = val;
      }
    }
  }

  const nextNumber = maxNumber > 0 ? Math.max(startingNumber, maxNumber + 1) : startingNumber;
  return `${prefix}${String(nextNumber).padStart(padLength, '0')}`;
}

/**
 * Generate Next Sequential Sales Invoice Number
 */
export function generateNextInvoiceNumber(
  existingInvoices: (string | undefined | null)[],
  prefix = 'INV-',
  tenantStartingNumber = 1001
): string {
  return generateNextCode(prefix, existingInvoices, tenantStartingNumber, 4);
}

/**
 * Generate Next Sequential Purchase Order Number
 */
export function generateNextPONumber(
  existingPOs: (string | undefined | null)[],
  prefix = 'PO-',
  tenantStartingNumber = 1001
): string {
  return generateNextCode(prefix, existingPOs, tenantStartingNumber, 4);
}

/**
 * Generate Next Sequential POS Invoice Number
 */
export function generateNextPOSInvoiceNumber(
  existingPOSInvoices: (string | undefined | null)[],
  prefix = 'POS-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingPOSInvoices, startingNumber, 4);
}

/**
 * Generate Next Sequential Product SKU
 */
export function generateNextSKU(
  existingSKUs: (string | undefined | null)[],
  prefix = 'SKU-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingSKUs, startingNumber, 4);
}

/**
 * Generate Next Sequential EAN-12 / UPC Barcode
 */
export function generateNextBarcode(
  existingBarcodes: (string | undefined | null)[],
  basePrefix = '8901000'
): string {
  let maxSuffix = 0;
  for (const b of existingBarcodes) {
    if (!b) continue;
    const num = parseInt(b.slice(-5), 10);
    if (!isNaN(num) && num > maxSuffix) {
      maxSuffix = num;
    }
  }
  const next = maxSuffix > 0 ? maxSuffix + 1 : 10001;
  return `${basePrefix}${String(next).padStart(5, '0')}`;
}

/**
 * Generate Next Sequential Customer Code
 */
export function generateNextCustomerCode(
  existingCodes: (string | undefined | null)[],
  prefix = 'CUST-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingCodes, startingNumber, 4);
}

/**
 * Generate Next Sequential Supplier Code
 */
export function generateNextSupplierCode(
  existingCodes: (string | undefined | null)[],
  prefix = 'SUPP-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingCodes, startingNumber, 4);
}

/**
 * Generate Next Sequential Expense Number
 */
export function generateNextExpenseNumber(
  existingExpenses: (string | undefined | null)[],
  prefix = 'EXP-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingExpenses, startingNumber, 4);
}

/**
 * Generate Next Sequential Account Number
 */
export function generateNextAccountNumber(
  existingAccounts: (string | undefined | null)[],
  prefix = 'ACC-',
  startingNumber = 1001
): string {
  return generateNextCode(prefix, existingAccounts, startingNumber, 4);
}

/**
 * Generate Next Sequential Payment Receipt / Disbursement Number
 */
export function generateNextPaymentNumber(
  existingPayments: (string | undefined | null)[],
  type: 'receipt' | 'payment' = 'receipt',
  startingNumber = 1001
): string {
  const prefix = type === 'receipt' ? 'RCPT-' : 'PMT-';
  return generateNextCode(prefix, existingPayments, startingNumber, 4);
}
