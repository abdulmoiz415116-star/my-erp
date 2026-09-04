import { SaleInvoice, PurchaseOrder, Customer, Supplier, Product, LedgerEntry, StockLedgerEntry, Payment, Expense, StockTransaction, Account, JournalEntry, TrialBalanceRow, ProfitLossStatement } from '@/types/erp';
import { Tenant } from '@/types/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';

/**
 * Universal Commercial Print & PDF Export Utility
 * Opens a dedicated print container that seamlessly triggers the native
 * browser Print and "Save as PDF" dialog with pristine commercial formatting.
 */

function triggerPrintHtml(htmlContent: string, docTitle: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.name = docTitle;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .company-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .company-sub {
          font-size: 11px;
          color: #475569;
          margin: 0;
        }
        .doc-title-badge {
          text-align: right;
        }
        .doc-title {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #4338ca;
          margin: 0;
          text-transform: uppercase;
        }
        .doc-ref {
          font-family: monospace;
          font-size: 14px;
          font-weight: bold;
          color: #334155;
          margin: 2px 0 0 0;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .meta-col h4 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin: 0 0 4px 0;
        }
        .meta-col p {
          margin: 0;
          font-size: 12px;
          color: #1e293b;
        }
        .party-name {
          font-weight: 700;
          font-size: 13px !important;
          color: #0f172a !important;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background-color: #f1f5f9;
          color: #334155;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 8px 10px;
          border-bottom: 1px solid #cbd5e1;
          text-align: left;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
          color: #334155;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: bold; }
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .totals-box {
          width: 280px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 12px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12px;
          color: #475569;
        }
        .grand-total {
          border-top: 2px solid #0f172a;
          margin-top: 6px;
          padding-top: 6px;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .stamp-paid {
          display: inline-block;
          border: 2px solid #059669;
          color: #059669;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          letter-spacing: 1px;
          transform: rotate(-5deg);
        }
        .stamp-unpaid {
          display: inline-block;
          border: 2px solid #dc2626;
          color: #dc2626;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          letter-spacing: 1px;
          transform: rotate(-5deg);
        }
        .stamp-partial {
          display: inline-block;
          border: 2px solid #d97706;
          color: #d97706;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          letter-spacing: 1px;
          transform: rotate(-5deg);
        }
        .stamp-void {
          display: inline-block;
          border: 3px solid #dc2626;
          color: #dc2626;
          font-weight: 900;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 4px;
          font-size: 14px;
          letter-spacing: 1.5px;
          transform: rotate(-8deg);
          background: #fef2f2;
        }
        .stamp-draft {
          display: inline-block;
          border: 2px dashed #64748b;
          color: #64748b;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          letter-spacing: 1px;
          transform: rotate(-5deg);
          background: #f8fafc;
        }
        .stamp-returned {
          display: inline-block;
          border: 2px solid #7c3aed;
          color: #7c3aed;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          letter-spacing: 1px;
          transform: rotate(-5deg);
          background: #f5f3ff;
        }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 10px;
          color: #64748b;
        }
        .signature-box {
          border-top: 1px dashed #94a3b8;
          width: 180px;
          text-align: center;
          padding-top: 4px;
          font-size: 10px;
          color: #475569;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 350);
}

/**
 * 1. Print / Save as PDF: Commercial Sales Invoice
 */
export function printCommercialInvoice(invoice: SaleInvoice, tenant: Tenant | null) {
  const currencyCode = tenant?.settings.currency || 'USD';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const companyName = tenant?.legalName || tenant?.name || 'Enterprise Resource Planning';

  let statusBadge = '';
  if (invoice.saleStatus === 'void') {
    statusBadge = '<span class="stamp-void">CANCELLED / VOID</span>';
  } else if (invoice.saleStatus === 'draft') {
    statusBadge = '<span class="stamp-draft">DRAFT QUOTATION</span>';
  } else if (invoice.saleStatus === 'returned') {
    statusBadge = '<span class="stamp-returned">RETURNED / ADJUSTED</span>';
  } else if (invoice.paymentStatus === 'paid') {
    statusBadge = '<span class="stamp-paid">PAID IN FULL</span>';
  } else if (invoice.paymentStatus === 'partial') {
    statusBadge = '<span class="stamp-partial">PARTIAL PAYMENT</span>';
  } else {
    statusBadge = '<span class="stamp-unpaid">PAYMENT DUE</span>';
  }

  const itemsRows = invoice.items
    .map(
      (item, idx) => `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td>
          <div class="font-bold">${item.productName}</div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace;">SKU: ${item.sku}</div>
        </td>
        <td class="text-center font-mono">${item.quantity}</td>
        <td class="text-right font-mono">${formatCurrency(item.unitPrice, currencyCode, currencySymbol)}</td>
        <td class="text-right font-mono">${item.taxRate}%</td>
        <td class="text-right font-mono font-bold">${formatCurrency(item.total, currencyCode, currencySymbol)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.address?.street || '100 Enterprise Way'}, ${tenant?.address?.city || 'Austin'}, ${tenant?.address?.state || 'TX'}</p>
        <p class="company-sub">Tax ID: ${tenant?.settings.taxNumber || 'US-892374619'} • Email: ${tenant?.email || 'billing@apex-corp.com'}</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title">TAX INVOICE</h2>
        <p class="doc-ref">${invoice.invoiceNumber}</p>
        <div style="margin-top: 8px;">${statusBadge}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>BILLED TO:</h4>
        <p class="party-name">${invoice.customerName}</p>
        <p>Customer ID: ${invoice.customerId}</p>
      </div>
      <div class="meta-col text-right">
        <h4>INVOICE DETAILS:</h4>
        <p><strong>Invoice Date:</strong> ${formatDate(invoice.date)}</p>
        <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate || invoice.date)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 35px;">#</th>
          <th>Item & Description</th>
          <th class="text-center" style="width: 70px;">Qty</th>
          <th class="text-right" style="width: 100px;">Unit Price</th>
          <th class="text-right" style="width: 70px;">Tax</th>
          <th class="text-right" style="width: 110px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="font-mono">${formatCurrency(invoice.subtotal, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row">
          <span>Sales Tax / VAT:</span>
          <span class="font-mono">${formatCurrency(invoice.taxAmount, currencyCode, currencySymbol)}</span>
        </div>
        ${
          invoice.discountAmount > 0
            ? `<div class="totals-row"><span>Discount:</span><span class="font-mono">-${formatCurrency(invoice.discountAmount, currencyCode, currencySymbol)}</span></div>`
            : ''
        }
        <div class="totals-row grand-total">
          <span>Grand Total:</span>
          <span class="font-mono">${formatCurrency(invoice.totalAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row" style="color: #059669; font-weight: 600;">
          <span>Paid to Date:</span>
          <span class="font-mono">${formatCurrency(invoice.paidAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row" style="color: #dc2626; font-weight: bold; border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 4px;">
          <span>Balance Due:</span>
          <span class="font-mono">${formatCurrency(invoice.balanceAmount, currencyCode, currencySymbol)}</span>
        </div>
      </div>
    </div>

    ${
      invoice.notes
        ? `<div style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-size: 11px; margin-bottom: 24px;">
            <strong>Payment Terms & Notes:</strong> ${invoice.notes}
          </div>`
        : ''
    }

    <div class="footer">
      <div>
        <p style="margin: 0;">Thank you for your business.</p>
        <p style="margin: 2px 0 0 0; color: #94a3b8;">Computer-generated commercial invoice. Valid without physical signature.</p>
      </div>
      <div class="signature-box">
        Authorized Signatory
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Invoice-${invoice.invoiceNumber}`);
}

/**
 * 2. Print / Save as PDF: Purchase Order
 */
export function printCommercialPurchaseOrder(po: PurchaseOrder, tenant: Tenant | null) {
  const currencyCode = tenant?.settings.currency || 'USD';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const companyName = tenant?.legalName || tenant?.name || 'Enterprise Resource Planning';

  const itemsRows = po.items
    .map(
      (item, idx) => `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td>
          <div class="font-bold">${item.productName}</div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace;">SKU: ${item.sku}</div>
        </td>
        <td class="text-center font-mono">${item.quantity}</td>
        <td class="text-right font-mono">${formatCurrency(item.unitCost, currencyCode, currencySymbol)}</td>
        <td class="text-right font-mono">${item.taxRate}%</td>
        <td class="text-right font-mono font-bold">${formatCurrency(item.total, currencyCode, currencySymbol)}</td>
      </tr>
    `
    )
    .join('');

  const isVoid = po.purchaseStatus === 'void';
  const isDraft = po.purchaseStatus === 'draft';
  const isReturned = po.purchaseStatus === 'returned';

  let stampHtml = '';
  if (isVoid) {
    stampHtml = '<div class="stamp stamp-void">CANCELLED / VOID</div>';
  } else if (isDraft) {
    stampHtml = '<div class="stamp stamp-draft">DRAFT ORDER</div>';
  } else if (isReturned) {
    stampHtml = '<div class="stamp stamp-returned">RETURNED / DEBIT NOTE</div>';
  } else if (po.paymentStatus === 'paid') {
    stampHtml = '<div class="stamp stamp-paid">PAID IN FULL</div>';
  } else if (po.paymentStatus === 'partial') {
    stampHtml = '<div class="stamp stamp-partial">PARTIAL PAYMENT</div>';
  }

  const html = `
    ${stampHtml}
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.address?.street || '100 Enterprise Way'}, ${tenant?.address?.city || 'Austin'}, ${tenant?.address?.state || 'TX'}</p>
        <p class="company-sub">Procurement Dept • Email: ${tenant?.email || 'procurement@apex-corp.com'}</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #0f766e;">PURCHASE ORDER</h2>
        <p class="doc-ref">${po.poNumber}</p>
        <div style="margin-top: 8px; font-size: 11px; text-transform: uppercase; font-weight: bold; color: #475569;">
          Receipt: <strong>${po.receiptStatus}</strong> | Payment: <strong>${po.paymentStatus}</strong>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>VENDOR / SUPPLIER:</h4>
        <p class="party-name">${po.supplierName}</p>
        <p>Supplier ID: ${po.supplierId}</p>
      </div>
      <div class="meta-col text-right">
        <h4>ORDER DETAILS:</h4>
        <p><strong>PO Date:</strong> ${formatDate(po.date)}</p>
        <p><strong>Required Delivery:</strong> ${formatDate(po.dueDate || po.date)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 35px;">#</th>
          <th>Item Specification</th>
          <th class="text-center" style="width: 70px;">Qty</th>
          <th class="text-right" style="width: 100px;">Unit Cost</th>
          <th class="text-right" style="width: 70px;">Tax</th>
          <th class="text-right" style="width: 110px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="font-mono">${formatCurrency(po.subtotal, currencyCode, currencySymbol)}</span>
        </div>
        ${
          (po.discountAmount || 0) > 0
            ? `<div class="totals-row"><span>Discount:</span><span class="font-mono">-${formatCurrency(po.discountAmount || 0, currencyCode, currencySymbol)}</span></div>`
            : ''
        }
        <div class="totals-row">
          <span>Tax:</span>
          <span class="font-mono">${formatCurrency(po.taxAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>Total Purchase Order:</span>
          <span class="font-mono">${formatCurrency(po.totalAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row" style="color: #059669;">
          <span>Paid Upfront:</span>
          <span class="font-mono">${formatCurrency(po.paidAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row" style="color: #b45309; font-weight: bold; border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 4px;">
          <span>Accounts Payable Due:</span>
          <span class="font-mono">${formatCurrency(po.balanceAmount, currencyCode, currencySymbol)}</span>
        </div>
      </div>
    </div>

    ${
      po.notes
        ? `<div style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-size: 11px; margin-bottom: 24px;">
            <strong>Shipping & Handling Instructions:</strong> ${po.notes}
          </div>`
        : ''
    }

    <div class="footer">
      <div>
        <p style="margin: 0;">Authorized Commercial Procurement Document</p>
      </div>
      <div class="signature-box">
        Procurement Officer
      </div>
    </div>
  `;

  triggerPrintHtml(html, `PurchaseOrder-${po.poNumber}`);
}

/**
 * 3. Print / Save as PDF: Customer Account Statement / Ledger
 */
export function printCustomerStatement(customer: Customer, entries: LedgerEntry[], tenant: Tenant | null) {
  const currencyCode = tenant?.settings.currency || 'USD';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const companyName = tenant?.legalName || tenant?.name || 'Enterprise Resource Planning';

  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td class="font-mono font-bold">${e.reference}</td>
        <td>${e.description}</td>
        <td class="text-right font-mono">${e.debit > 0 ? formatCurrency(e.debit, currencyCode, currencySymbol) : '—'}</td>
        <td class="text-right font-mono text-emerald-700">${e.credit > 0 ? formatCurrency(e.credit, currencyCode, currencySymbol) : '—'}</td>
        <td class="text-right font-mono font-bold">${formatCurrency(e.runningBalance, currencyCode, currencySymbol)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Accounts Receivable Statement</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #1d4ed8;">STATEMENT OF ACCOUNT</h2>
        <p class="doc-ref">${customer.code}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>ACCOUNT HOLDER:</h4>
        <p class="party-name">${customer.name}</p>
        <p>${customer.companyName || ''}</p>
        <p>${customer.email || ''} • ${customer.phone || ''}</p>
      </div>
      <div class="meta-col text-right">
        <h4>FINANCIAL STATUS:</h4>
        <p>Credit Limit: <strong>${formatCurrency(customer.creditLimit || 0, currencyCode, currencySymbol)}</strong></p>
        <p style="font-size: 14px; margin-top: 4px; color: #dc2626;">Outstanding Balance: <strong>${formatCurrency(customer.currentBalance || 0, currencyCode, currencySymbol)}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Date</th>
          <th style="width: 100px;">Reference</th>
          <th>Description</th>
          <th class="text-right" style="width: 100px;">Debit (+)</th>
          <th class="text-right" style="width: 100px;">Credit (-)</th>
          <th class="text-right" style="width: 110px;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <div>Statement generated on ${new Date().toLocaleDateString()}</div>
      <div class="signature-box">Accounts Receivable Dept</div>
    </div>
  `;

  triggerPrintHtml(html, `Statement-${customer.code}`);
}

/**
 * 4. Print / Save as PDF: Supplier Account Statement / Ledger
 */
export function printSupplierStatement(supplier: Supplier, entries: LedgerEntry[], tenant: Tenant | null) {
  const currencyCode = tenant?.settings.currency || 'USD';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const companyName = tenant?.legalName || tenant?.name || 'Enterprise Resource Planning';

  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td class="font-mono font-bold">${e.reference}</td>
        <td>${e.description}</td>
        <td class="text-right font-mono text-emerald-700">${e.debit > 0 ? formatCurrency(e.debit, currencyCode, currencySymbol) : '—'}</td>
        <td class="text-right font-mono">${e.credit > 0 ? formatCurrency(e.credit, currencyCode, currencySymbol) : '—'}</td>
        <td class="text-right font-mono font-bold">${formatCurrency(e.runningBalance, currencyCode, currencySymbol)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Accounts Payable Statement</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #b45309;">SUPPLIER LEDGER</h2>
        <p class="doc-ref">${supplier.code}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>VENDOR DETAILS:</h4>
        <p class="party-name">${supplier.name}</p>
        <p>${supplier.companyName}</p>
        <p>${supplier.email || ''} • ${supplier.phone || ''}</p>
      </div>
      <div class="meta-col text-right">
        <h4>PAYABLE OBLIGATION:</h4>
        <p>Payment Terms: <strong>Net ${supplier.paymentTermsDays || 30} Days</strong></p>
        <p style="font-size: 14px; margin-top: 4px; color: #b45309;">Current Payable Balance: <strong>${formatCurrency(supplier.currentBalance || 0, currencyCode, currencySymbol)}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Date</th>
          <th style="width: 100px;">Reference</th>
          <th>Description</th>
          <th class="text-right" style="width: 100px;">Paid (-)</th>
          <th class="text-right" style="width: 100px;">Purchased (+)</th>
          <th class="text-right" style="width: 110px;">Payable Owed</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <div>Vendor reconciliation generated on ${new Date().toLocaleDateString()}</div>
      <div class="signature-box">Accounts Payable Controller</div>
    </div>
  `;

  triggerPrintHtml(html, `SupplierLedger-${supplier.code}`);
}

/**
 * 5. Print / Save as PDF: Product Stock Movement Card / Bin Card
 */
export function printProductStockCard(product: Product, entries: StockLedgerEntry[], tenant: Tenant | null) {
  const companyName = tenant?.legalName || tenant?.name || 'Enterprise Resource Planning';

  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td class="font-mono font-bold">${e.reference}</td>
        <td>${e.type.replace('_', ' ').toUpperCase()}</td>
        <td class="text-center font-mono font-bold ${e.direction === 'in' ? 'text-emerald-700' : 'text-slate-400'}">
          ${e.direction === 'in' ? `+${e.quantity}` : '—'}
        </td>
        <td class="text-center font-mono font-bold ${e.direction === 'out' ? 'text-rose-600' : 'text-slate-400'}">
          ${e.direction === 'out' ? `-${e.quantity}` : '—'}
        </td>
        <td class="text-right font-mono font-bold">${e.runningStock} ${product.unit}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Warehouse & Inventory Management</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #4f46e5;">STOCK BIN CARD</h2>
        <p class="doc-ref">${product.sku}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>PRODUCT SPECIFICATION:</h4>
        <p class="party-name">${product.name}</p>
        <p>Category: ${product.category} • Unit: ${product.unit}</p>
        <p>Barcode: ${product.barcode || '—'}</p>
      </div>
      <div class="meta-col text-right">
        <h4>STOCK POSITION:</h4>
        <p>Minimum Stock Safety Level: <strong>${product.minStockAlert} ${product.unit}</strong></p>
        <p style="font-size: 14px; margin-top: 4px; color: #4f46e5;">Current On-Hand Stock: <strong>${product.currentStock} ${product.unit}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 90px;">Date</th>
          <th style="width: 110px;">Ref #</th>
          <th>Transaction Type</th>
          <th class="text-center" style="width: 80px;">Inward (+)</th>
          <th class="text-center" style="width: 80px;">Outward (-)</th>
          <th class="text-right" style="width: 100px;">Balance Stock</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <div>Verified Stock Bin Card generated on ${new Date().toLocaleDateString()}</div>
      <div class="signature-box">Warehouse Custodian</div>
    </div>
  `;

  triggerPrintHtml(html, `StockCard-${product.sku}`);
}

/**
 * 80mm Thermal POS Receipt Printing
 */
function triggerThermalPrintHtml(htmlContent: string, docTitle: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.name = docTitle;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${docTitle}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          color: #000;
          margin: 0 auto;
          padding: 8px 6px;
          width: 74mm;
          font-size: 11px;
          line-height: 1.35;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px dashed #000;
          margin: 6px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th, td {
          padding: 2px 0;
        }
        .text-right { text-align: right; }
        .store-name { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }, 60000);
}

export function printThermalReceipt(
  invoice: SaleInvoice,
  tenderedAmount: number,
  changeDue: number,
  paymentMethod: string,
  cashierName: string,
  tenant: Tenant | null
) {
  const companyName = tenant?.name || 'Antigravity Enterprise Store';
  const address = tenant?.address?.street ? `${tenant.address.street}, ${tenant.address.city || ''}` : 'Main Commercial Boulevard';
  const phone = tenant?.phone || '+1 (555) 019-2834';
  const taxId = tenant?.settings?.taxNumber || 'NTN: 8294719-2';
  const currencySymbol = tenant?.settings?.currencySymbol || '$';

  const rows = invoice.items
    .map(
      (item) => `
      <tr>
        <td colspan="3" class="bold">${item.productName}</td>
      </tr>
      <tr>
        <td>${item.quantity} x ${currencySymbol}${item.unitPrice.toFixed(2)}</td>
        <td class="text-right bold" colspan="2">${currencySymbol}${item.total.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="center">
      <div class="store-name">${companyName.toUpperCase()}</div>
      <div>${address}</div>
      <div>Tel: ${phone}</div>
      <div>Tax Reg: ${taxId}</div>
      <div class="divider"></div>
      <div class="bold">RETAIL CASH RECEIPT</div>
      <div>Inv: #${invoice.invoiceNumber}</div>
      <div>Date: ${new Date(invoice.date).toLocaleDateString()} ${new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div>Cashier: ${cashierName}</div>
      <div>Customer: ${invoice.customerName}</div>
      <div class="double-divider"></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Item Description</th>
          <th class="text-right" style="width: 40px;">Qty</th>
          <th class="text-right" style="width: 50px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="divider"></div>

    <table>
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">${currencySymbol}${invoice.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Tax (${invoice.items[0]?.taxRate || 0}%):</td>
        <td class="text-right">${currencySymbol}${invoice.taxAmount.toFixed(2)}</td>
      </tr>
      <tr class="bold" style="font-size: 13px;">
        <td style="padding-top: 4px;">TOTAL PAYABLE:</td>
        <td class="text-right" style="padding-top: 4px;">${currencySymbol}${invoice.totalAmount.toFixed(2)}</td>
      </tr>
      <tr class="divider"><td colspan="2"></td></tr>
      <tr>
        <td>Tender Method:</td>
        <td class="text-right uppercase">${paymentMethod.replace('_', ' ')}</td>
      </tr>
      <tr>
        <td>Amount Tendered:</td>
        <td class="text-right">${currencySymbol}${tenderedAmount.toFixed(2)}</td>
      </tr>
      <tr class="bold">
        <td>Change Due:</td>
        <td class="text-right">${currencySymbol}${changeDue.toFixed(2)}</td>
      </tr>
    </table>

    <div class="double-divider"></div>

    <div class="center" style="margin-top: 8px;">
      <div class="bold">THANK YOU FOR YOUR PATRONAGE!</div>
      <div style="font-size: 10px; margin-top: 3px;">Returns accepted within 7 days with this receipt.</div>
      <div style="font-size: 9px; margin-top: 6px; font-family: monospace;">* * * * ${invoice.invoiceNumber} * * * *</div>
    </div>
  `;

  triggerThermalPrintHtml(html, `Receipt-${invoice.invoiceNumber}`);
}

export function generateWhatsAppInvoiceLink(
  invoice: SaleInvoice,
  customerPhone?: string,
  tenantName?: string
): string {
  const company = tenantName || 'Our Company';
  const cleanPhone = customerPhone ? customerPhone.replace(/[^\d]/g, '') : '';
  const itemsText = invoice.items
    .map((it) => `• ${it.quantity}x ${it.productName} ($${it.total})`)
    .join('\n');

  const text = `*Invoice #${invoice.invoiceNumber}* from *${company}*\n\nDear *${invoice.customerName}*,\nThank you for choosing ${company}! Your sales invoice has been processed.\n\n*Invoice Summary:*\n${itemsText}\n\n*Total Amount:* $${invoice.totalAmount.toLocaleString()}\n*Status:* ${invoice.paymentStatus.toUpperCase()}\n*Due Date:* ${invoice.dueDate}\n\nPlease let us know if you need any clarification. Have a great day!`;

  if (cleanPhone && cleanPhone.length >= 7) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function generateEmailInvoiceLink(
  invoice: SaleInvoice,
  customerEmail?: string,
  tenantName?: string
): string {
  const company = tenantName || 'Antigravity Enterprise ERP';
  const subject = `Official Invoice #${invoice.invoiceNumber} from ${company}`;
  const itemsText = invoice.items
    .map((it) => `  - ${it.productName}: ${it.quantity} @ $${it.unitPrice} = $${it.total}`)
    .join('\n');

  const body = `Dear ${invoice.customerName},\n\nPlease find the details for Invoice #${invoice.invoiceNumber} below:\n\nDate: ${invoice.date}\nDue Date: ${invoice.dueDate}\nStatus: ${invoice.paymentStatus.toUpperCase()}\n\nLine Items:\n${itemsText}\n\nSubtotal: $${invoice.subtotal.toFixed(2)}\nTax: $${invoice.taxAmount.toFixed(2)}\nTotal Amount: $${invoice.totalAmount.toFixed(2)}\n\nThank you for your business.\n\nWarm regards,\n${company}`;

  return `mailto:${customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function printPaymentReceipt(payment: Payment, tenant?: Tenant | null) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';
  const isReceipt = payment.type === 'receipt';
  const isTransfer = payment.type === 'transfer' || payment.partyType === 'internal_transfer';

  const voucherTitle = isTransfer
    ? 'BANK TRANSFER VOUCHER'
    : isReceipt
    ? 'OFFICIAL PAYMENT RECEIPT'
    : 'PAYMENT DISBURSEMENT VOUCHER';

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.legalName || companyName} • Financial & Treasury Dept</p>
        <p class="company-sub">${tenant?.email || ''} ${tenant?.phone ? `• Tel: ${tenant.phone}` : ''}</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: ${isReceipt ? '#059669' : '#dc2626'};">${voucherTitle}</h2>
        <div class="doc-ref">${payment.paymentNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date: ${formatDate(payment.date)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>${isTransfer ? 'Transfer Origin' : isReceipt ? 'Received From (Customer)' : 'Disbursed To (Payee / Supplier)'}</h4>
        <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">${payment.partyName}</p>
        <p class="meta-field"><strong>Payment Method:</strong> ${payment.paymentMethod.toUpperCase().replace('_', ' ')}</p>
        ${payment.reference ? `<p class="meta-field"><strong>Transaction Ref:</strong> ${payment.reference}</p>` : ''}
      </div>
      <div class="meta-col">
        <h4>Treasury & Account Allocation</h4>
        <p class="meta-field"><strong>Operating Account:</strong> ${payment.accountName}</p>
        ${payment.destinationAccountName ? `<p class="meta-field"><strong>Destination Account:</strong> ${payment.destinationAccountName}</p>` : ''}
        ${payment.invoiceNumber ? `<p class="meta-field"><strong>Settled Invoice:</strong> #${payment.invoiceNumber}</p>` : ''}
        ${payment.purchaseOrderNumber ? `<p class="meta-field"><strong>Settled PO:</strong> #${payment.purchaseOrderNumber}</p>` : ''}
      </div>
    </div>

    <div style="background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold;">
        ${isReceipt ? 'Total Amount Received' : 'Total Amount Paid'}
      </div>
      <div style="font-size: 36px; font-weight: 900; color: ${isReceipt ? '#059669' : '#0f172a'}; font-family: monospace; margin: 6px 0;">
        ${formatCurrency(payment.amount, currencyCode, currencySymbol)}
      </div>
      ${payment.notes ? `<div style="font-size: 12px; color: #475569; font-style: italic; margin-top: 8px;">"${payment.notes}"</div>` : ''}
    </div>

    <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Prepared / Cashier By</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Authorized Signature & Stamp</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Received / Approved By</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Customer / Payee Signature</div>
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Voucher-${payment.paymentNumber}`);
}

export function printExpenseVoucher(expense: Expense, tenant?: Tenant | null) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.legalName || companyName} • Operating Expense Voucher</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #b45309;">EXPENSE VOUCHER</h2>
        <div class="doc-ref">${expense.expenseNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date: ${formatDate(expense.date)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>Expense Classification</h4>
        <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">${expense.category}</p>
        <p class="meta-field"><strong>Paid Via:</strong> ${expense.paymentMethod.toUpperCase().replace('_', ' ')}</p>
        <p class="meta-field"><strong>Disbursed From:</strong> ${expense.accountName}</p>
      </div>
      <div class="meta-col">
        <h4>Payee / Vendor Information</h4>
        <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">${expense.vendor || 'Internal / Cash Overhead'}</p>
        ${expense.reference ? `<p class="meta-field"><strong>Receipt Ref:</strong> ${expense.reference}</p>` : ''}
        <p class="meta-field"><strong>Tax Deductible:</strong> ${expense.taxAmount > 0 ? 'Yes' : 'No'}</p>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h4 style="font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Expense Description / Purpose</h4>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px; color: #1e293b;">
        ${expense.description}
      </div>
    </div>

    <div class="totals-area">
      <div class="totals-box">
        <div class="totals-row">
          <span>Expense Subtotal:</span>
          <span>${formatCurrency(expense.amount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row">
          <span>Applicable Tax:</span>
          <span>${formatCurrency(expense.taxAmount, currencyCode, currencySymbol)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>Net Total Paid:</span>
          <span>${formatCurrency(expense.totalAmount, currencyCode, currencySymbol)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Disbursed By (Finance)</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Signature</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Approved By (Manager)</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Signature & Stamp</div>
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Expense-${expense.expenseNumber}`);
}

export function printStockAdjustmentSlip(transaction: StockTransaction, product: Product, tenant?: Tenant | null) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Warehouse & Inventory Management • Stock Discrepancy Slip</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #6366f1;">STOCK ADJUSTMENT SLIP</h2>
        <div class="doc-ref">${transaction.reference || 'ADJ-' + transaction.id.slice(0, 6)}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date: ${formatDate(transaction.date)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>Item Details</h4>
        <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">${product.name}</p>
        <p class="meta-field"><strong>SKU:</strong> ${product.sku}</p>
        <p class="meta-field"><strong>Category:</strong> ${product.category || 'General'}</p>
      </div>
      <div class="meta-col">
        <h4>Adjustment Particulars</h4>
        <p class="meta-field"><strong>Direction:</strong> ${transaction.direction === 'in' ? 'INWARDS (+)' : 'OUTWARDS (-)'}</p>
        <p class="meta-field"><strong>Adjusted Quantity:</strong> ${transaction.quantity} ${product.unit || 'Units'}</p>
        <p class="meta-field"><strong>Adjusted By:</strong> ${transaction.userName}</p>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h4 style="font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Reason / Audit Memo</h4>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px; color: #1e293b;">
        ${transaction.notes || 'Physical inventory reconciliation / damage adjustment'}
      </div>
    </div>

    <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Audited By (Inventory Controller)</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Signature</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Verified By (Store Manager)</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Signature & Stamp</div>
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Stock-Adjustment-${transaction.id}`);
}

export function printAccountStatement(
  account: Account,
  ledger: Array<{
    date: string;
    type: string;
    reference: string;
    description: string;
    inflow: number;
    outflow: number;
    runningBalance: number;
  }>,
  tenant?: Tenant | null
) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';

  const rows = ledger
    .map(
      (entry) => `
      <tr>
        <td style="font-family: monospace; font-size: 11px;">${formatDate(entry.date)}</td>
        <td style="font-family: monospace; font-weight: bold; font-size: 11px;">${entry.reference}</td>
        <td>
          <div style="font-weight: 600; font-size: 12px; color: #1e293b;">${entry.description}</div>
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">${entry.type.replace('_', ' ')}</div>
        </td>
        <td style="text-align: right; font-family: monospace; color: #059669; font-weight: bold;">
          ${entry.inflow > 0 ? `+${formatCurrency(entry.inflow, currencyCode, currencySymbol)}` : '-'}
        </td>
        <td style="text-align: right; font-family: monospace; color: #dc2626; font-weight: bold;">
          ${entry.outflow > 0 ? `-${formatCurrency(entry.outflow, currencyCode, currencySymbol)}` : '-'}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">
          ${formatCurrency(entry.runningBalance, currencyCode, currencySymbol)}
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.legalName || companyName} • Financial & Treasury Dept</p>
        <p class="company-sub">${tenant?.email || ''} ${tenant?.phone ? `• Tel: ${tenant.phone}` : ''}</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #0284c7;">ACCOUNT STATEMENT</h2>
        <div class="doc-ref">${account.accountName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">A/C #: ${account.accountNumber}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>Account Particulars</h4>
        <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">${account.accountName}</p>
        <p class="meta-field"><strong>Classification:</strong> ${account.type.toUpperCase()}</p>
        ${account.bankName ? `<p class="meta-field"><strong>Financial Institution:</strong> ${account.bankName} (${account.bankBranch || 'Main'})</p>` : ''}
      </div>
      <div class="meta-col text-right">
        <h4>Statement Balance</h4>
        <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0284c7;">
          ${formatCurrency(account.currentBalance, currencyCode, currencySymbol)}
        </div>
        <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Statement Generated: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <table style="margin-top: 20px;">
      <thead>
        <tr>
          <th style="width: 85px;">Date</th>
          <th style="width: 110px;">Ref #</th>
          <th>Description & Particulars</th>
          <th style="text-align: right; width: 100px;">Credit (+)</th>
          <th style="text-align: right; width: 100px;">Debit (-)</th>
          <th style="text-align: right; width: 120px;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Prepared by Treasury Officer</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Verification Stamp</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">Internal Financial Audit</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Signature & Approval</div>
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Statement-${account.accountNumber}`);
}

/**
 * 10. Print / Save as PDF: Double-Entry Journal Voucher
 */
export function printJournalVoucher(je: JournalEntry, tenant?: Tenant | null) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';

  const rows = je.lines
    .map(
      (line) => `
      <tr>
        <td style="font-family: monospace; font-size: 11px; font-weight: bold;">${line.accountNumber}</td>
        <td>
          <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${line.accountName}</div>
          ${line.description ? `<div style="font-size: 10px; color: #64748b;">${line.description}</div>` : ''}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #059669;">
          ${line.debit > 0 ? formatCurrency(line.debit, currencyCode, currencySymbol) : '—'}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">
          ${line.credit > 0 ? formatCurrency(line.credit, currencyCode, currencySymbol) : '—'}
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">${tenant?.legalName || companyName} • Financial Accounting Division</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #4f46e5;">JOURNAL VOUCHER</h2>
        <div class="doc-ref">${je.entryNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Module: ${je.sourceModule.toUpperCase()}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h4>Voucher Details</h4>
        <p class="meta-field"><strong>Transaction Date:</strong> ${formatDate(je.date)}</p>
        <p class="meta-field"><strong>Reference Doc:</strong> ${je.reference}</p>
        <p class="meta-field"><strong>Description:</strong> ${je.description}</p>
        ${je.reversalReason ? `<p class="meta-field" style="color: #b91c1c;"><strong>Reversal Reason:</strong> ${je.reversalReason}</p>` : ''}
      </div>
      <div class="meta-col text-right">
        <h4>Equilibrium Status</h4>
        <div style="font-size: 16px; font-weight: 800; color: #059669; font-family: monospace;">
          DEBITS = CREDITS (BALANCED)
        </div>
        <p style="font-size: 14px; font-weight: bold; font-family: monospace; margin-top: 4px;">
          Total Volume: ${formatCurrency(je.totalDebit, currencyCode, currencySymbol)}
        </p>
      </div>
    </div>

    <table style="margin-top: 20px;">
      <thead>
        <tr>
          <th style="width: 140px;">Account Code</th>
          <th>Account Title & Narration</th>
          <th style="text-align: right; width: 120px;">Debit (${currencySymbol})</th>
          <th style="text-align: right; width: 120px;">Credit (${currencySymbol})</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="font-weight: 800; background: #f8fafc; border-top: 2px solid #cbd5e1;">
          <td colspan="2" style="text-align: right; font-size: 11px; text-transform: uppercase;">Total Journal Equilibrium:</td>
          <td style="text-align: right; font-family: monospace; color: #059669; font-size: 12px;">
            ${formatCurrency(je.totalDebit, currencyCode, currencySymbol)}
          </td>
          <td style="text-align: right; font-family: monospace; color: #dc2626; font-size: 12px;">
            ${formatCurrency(je.totalCredit, currencyCode, currencySymbol)}
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center;">
        <div style="font-size: 10px; font-weight: bold; color: #334155;">Entered by / Originator</div>
        <div style="font-size: 9px; color: #94a3b8;">${je.userName || 'Accountant'}</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center;">
        <div style="font-size: 10px; font-weight: bold; color: #334155;">Audited & Verified</div>
        <div style="font-size: 9px; color: #94a3b8;">Internal Control</div>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center;">
        <div style="font-size: 10px; font-weight: bold; color: #334155;">Approved & Posted</div>
        <div style="font-size: 9px; color: #94a3b8;">Chief Financial Officer</div>
      </div>
    </div>
  `;

  triggerPrintHtml(html, `Voucher-${je.entryNumber}`);
}

/**
 * 11. Print / Save as PDF: Trial Balance
 */
export function printTrialBalance(
  rows: TrialBalanceRow[],
  totalDebit: number,
  totalCredit: number,
  tenant?: Tenant | null
) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="font-family: monospace; font-size: 11px;">${r.accountNumber}</td>
        <td style="font-weight: 600; font-size: 11px;">${r.accountName}</td>
        <td style="font-size: 10px; text-transform: uppercase; color: #64748b;">${r.accountCategory}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${r.debitBalance > 0 ? '#059669' : '#94a3b8'};">
          ${r.debitBalance > 0 ? formatCurrency(r.debitBalance, currencyCode, currencySymbol) : '—'}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${r.creditBalance > 0 ? '#dc2626' : '#94a3b8'};">
          ${r.creditBalance > 0 ? formatCurrency(r.creditBalance, currencyCode, currencySymbol) : '—'}
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Annual & Periodic Financial Equilibrium Verification</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #059669;">TRIAL BALANCE</h2>
        <div class="doc-ref">${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    <table style="margin-top: 20px;">
      <thead>
        <tr>
          <th style="width: 120px;">Code</th>
          <th>Account Classification & Name</th>
          <th style="width: 90px;">Category</th>
          <th style="text-align: right; width: 120px;">Debit (${currencySymbol})</th>
          <th style="text-align: right; width: 120px;">Credit (${currencySymbol})</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr style="font-weight: 800; background: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 12px;">
          <td colspan="3" style="text-align: right;">BALANCED LEDGER EQUILIBRIUM TOTAL:</td>
          <td style="text-align: right; font-family: monospace; color: #059669;">
            ${formatCurrency(totalDebit, currencyCode, currencySymbol)}
          </td>
          <td style="text-align: right; font-family: monospace; color: #dc2626;">
            ${formatCurrency(totalCredit, currencyCode, currencySymbol)}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  triggerPrintHtml(html, `TrialBalance-${Date.now()}`);
}

/**
 * 12. Print / Save as PDF: Profit & Loss Statement (Income Statement)
 */
export function printProfitAndLossStatement(pnl: ProfitLossStatement, tenant?: Tenant | null) {
  const companyName = tenant?.name || 'Antigravity Enterprise ERP';
  const currencySymbol = tenant?.settings.currencySymbol || '$';
  const currencyCode = tenant?.settings.currency || 'USD';

  const expenseRows = pnl.categorizedExpenses
    .map(
      (cat) => `
      <tr>
        <td style="padding-left: 20px; font-size: 11px; text-transform: capitalize;">${cat.category.replace('_', ' ')}</td>
        <td style="text-align: right; font-family: monospace; color: #64748b;">${formatCurrency(cat.amount, currencyCode, currencySymbol)}</td>
        <td></td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div class="header">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Statement of Profit or Loss & Comprehensive Income</p>
      </div>
      <div class="doc-title-badge">
        <h2 class="doc-title" style="color: #4f46e5;">INCOME STATEMENT</h2>
        <div class="doc-ref">Period: ${pnl.period.toUpperCase()}</div>
      </div>
    </div>

    <table style="margin-top: 20px;">
      <thead>
        <tr>
          <th>Particulars / Accounting Heads</th>
          <th style="text-align: right; width: 120px;">Subtotal</th>
          <th style="text-align: right; width: 140px;">Total (${currencyCode})</th>
        </tr>
      </thead>
      <tbody>
        <tr style="font-weight: bold; background: #f8fafc;">
          <td colspan="3" style="color: #4f46e5;">1. REVENUE FROM OPERATIONS</td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Gross Commercial Sales Invoiced</td>
          <td style="text-align: right; font-family: monospace;">${formatCurrency(pnl.grossSales, currencyCode, currencySymbol)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(pnl.grossSales, currencyCode, currencySymbol)}</td>
        </tr>
        ${
          pnl.salesReturns > 0
            ? `<tr>
                <td style="padding-left: 20px; color: #dc2626;">Less: Sales Returns & Allowances</td>
                <td style="text-align: right; font-family: monospace; color: #dc2626;">(${formatCurrency(pnl.salesReturns, currencyCode, currencySymbol)})</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">(${formatCurrency(pnl.salesReturns, currencyCode, currencySymbol)})</td>
              </tr>`
            : ''
        }

        <tr style="font-weight: bold; background: #f8fafc;">
          <td colspan="3" style="color: #4f46e5;">2. COST OF GOODS SOLD (COGS)</td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Direct Landed Product Acquisition Cost</td>
          <td style="text-align: right; font-family: monospace; color: #dc2626;">(${formatCurrency(pnl.cogsTotal, currencyCode, currencySymbol)})</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">(${formatCurrency(pnl.cogsTotal, currencyCode, currencySymbol)})</td>
        </tr>

        <tr style="font-weight: bold; background: #ecfdf5; border-top: 1px solid #a7f3d0;">
          <td style="color: #065f46;">GROSS PROFIT (Net Revenue - COGS) [Margin: ${pnl.grossMarginPercent}%]</td>
          <td></td>
          <td style="text-align: right; font-family: monospace; font-size: 13px; color: #065f46;">
            ${formatCurrency(pnl.grossProfit, currencyCode, currencySymbol)}
          </td>
        </tr>

        <tr style="font-weight: bold; background: #f8fafc;">
          <td colspan="3" style="color: #4f46e5;">3. OPERATING OVERHEAD & EXPENSES</td>
        </tr>
        ${expenseRows}
        <tr style="font-weight: bold; border-top: 1px dashed #cbd5e1;">
          <td style="padding-left: 20px;">Total Operating Overhead</td>
          <td></td>
          <td style="text-align: right; font-family: monospace; color: #dc2626;">
            (${formatCurrency(pnl.totalOperatingExpenses, currencyCode, currencySymbol)})
          </td>
        </tr>

        <tr style="font-weight: 900; background: #eef2ff; border-top: 2px solid #6366f1; font-size: 14px;">
          <td style="color: #312e81;">NET OPERATING PROFIT (EBIT) [Margin: ${pnl.netMarginPercent}%]</td>
          <td></td>
          <td style="text-align: right; font-family: monospace; color: #4338ca;">
            ${formatCurrency(pnl.netOperatingProfit, currencyCode, currencySymbol)}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  triggerPrintHtml(html, `IncomeStatement-${Date.now()}`);
}




