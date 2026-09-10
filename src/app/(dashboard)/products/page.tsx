'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import {
  ProductService,
  CategoryService,
  StockTransactionService,
  SaleService,
  PurchaseService,
  calculateProductCurrentStock,
  validateStockDeduction,
} from '@/services/erp.service';
import { Product, Category, StockTransaction, StockTransactionType, SaleInvoice, PurchaseOrder } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { StockAdjustmentModal } from '@/components/products/StockAdjustmentModal';
import { printStockAdjustmentSlip, printBarcodeLabels } from '@/lib/pdfPrint';
import { generateNextSKU, generateNextBarcode } from '@/lib/sequenceGenerator';
import {
  Plus,
  Package,
  AlertTriangle,
  Barcode,
  Layers,
  SlidersHorizontal,
  FolderTree,
  Eye,
  TrendingUp,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Sparkles,
  Printer,
} from 'lucide-react';

type PageTab = 'catalog' | 'transactions' | 'categories';

export default function ProductsPage() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<PageTab>('catalog');

  // Real-time Collections
  const {
    items: products,
    totalCount: productsCount,
    loading: productsLoading,
    page: productsPage,
    pageSize: productsPageSize,
    totalPages: productsTotalPages,
    setPage: setProductsPage,
    setPageSize: setProductsPageSize,
    statusFilter: productStatusFilter,
    setStatusFilter: setProductStatusFilter,
    searchQuery: productSearchQuery,
    setSearchQuery: setProductSearchQuery,
    sortBy: productSortBy,
    sortDirection: productSortDirection,
    setSortBy: setProductSortBy,
    setSortDirection: setProductSortDirection,
    createItem: createProduct,
    updateItem: updateProduct,
    toggleStatus: toggleProductStatus,
    softDeleteItem: softDeleteProduct,
  } = useRealtimeCollection<Product>((tenantId) => new ProductService(tenantId), {
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const {
    items: categories,
    createItem: createCategory,
    updateItem: updateCategory,
    toggleStatus: toggleCategoryStatus,
    softDeleteItem: softDeleteCategory,
  } = useRealtimeCollection<Category>((tenantId) => new CategoryService(tenantId), {
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const {
    items: stockTransactions,
    allItems: allStockTransactions,
    createItem: createStockTransaction,
  } = useRealtimeCollection<StockTransaction>((tenantId) => new StockTransactionService(tenantId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  const { allItems: sales } = useRealtimeCollection<SaleInvoice>((tenantId) => new SaleService(tenantId));
  const { allItems: purchases } = useRealtimeCollection<PurchaseOrder>((tenantId) => new PurchaseService(tenantId));

  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currency = currentTenant?.settings.currency || 'USD';
  const allowNegativeInventory = currentTenant?.settings.allowNegativeInventory || false;

  // Real-Time Transaction-Derived Stock Dictionary (Calculated across entire transaction ledger)
  const productStocks = useMemo(() => {
    const dict: Record<string, number> = {};
    products.forEach((p) => {
      dict[p.id] = calculateProductCurrentStock(p, allStockTransactions);
    });
    return dict;
  }, [products, allStockTransactions]);

  // Modals State
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustmentTargetProduct, setAdjustmentTargetProduct] = useState<Product | null>(null);

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDescription, setCatDescription] = useState('');

  // Delete Guardrail Modal State
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  // Filter Bar state for Catalog
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Filter Bar state for Stock Transactions
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [transactionSearchQuery, setTransactionSearchQuery] = useState<string>('');

  // Product Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [initialStock, setInitialStock] = useState('0');
  const [minStockAlert, setMinStockAlert] = useState('10');
  const [maxStockLevel, setMaxStockLevel] = useState('100');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Filtered Products for Catalog Tab
  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategoryFilter !== 'all' && p.category !== selectedCategoryFilter) {
        return false;
      }
      if (lowStockOnly) {
        const stock = productStocks[p.id] ?? p.currentStock ?? 0;
        if (stock > p.minStockAlert) return false;
      }
      return true;
    });
  }, [products, selectedCategoryFilter, lowStockOnly, productStocks]);

  // Overall Inventory KPI Metrics
  const totalInventoryValuation = useMemo(() => {
    return products.reduce((sum, p) => {
      if (p.isDeleted) return sum;
      const stock = productStocks[p.id] ?? p.currentStock ?? 0;
      return sum + Math.max(0, stock) * (p.costPrice || 0);
    }, 0);
  }, [products, productStocks]);

  const lowStockProductsCount = useMemo(() => {
    return products.filter((p) => {
      if (p.isDeleted || p.status === 'inactive') return false;
      const stock = productStocks[p.id] ?? p.currentStock ?? 0;
      return stock <= p.minStockAlert;
    }).length;
  }, [products, productStocks]);

  const outOfStockProductsCount = useMemo(() => {
    return products.filter((p) => {
      if (p.isDeleted || p.status === 'inactive') return false;
      const stock = productStocks[p.id] ?? p.currentStock ?? 0;
      return stock <= 0;
    }).length;
  }, [products, productStocks]);

  // Open Create Product Modal
  const openCreateProductModal = () => {
    setEditingProduct(null);
    setName('');
    const nextSku = generateNextSKU(products.map((p) => p.sku));
    const nextBarcode = generateNextBarcode(products.map((p) => p.barcode));
    setSku(nextSku);
    setBarcode(nextBarcode);
    setCategory(categories[0]?.name || 'General Machinery');
    setUnit('pcs');
    setCostPrice('45.00');
    setSellingPrice('90.00');
    setTaxRate('8.25');
    setInitialStock('25');
    setMinStockAlert('10');
    setMaxStockLevel('150');
    setDescription('');
    setImageUrl('');
    setProductFormOpen(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setSku(prod.sku);
    setBarcode(prod.barcode || '');
    setCategory(prod.category);
    setUnit(prod.unit);
    setCostPrice(String(prod.costPrice));
    setSellingPrice(String(prod.sellingPrice));
    setTaxRate(String(prod.taxRate));
    setInitialStock(String(productStocks[prod.id] ?? prod.currentStock ?? 0));
    setMinStockAlert(String(prod.minStockAlert));
    setMaxStockLevel(prod.maxStockLevel ? String(prod.maxStockLevel) : '100');
    setDescription(prod.description || '');
    setImageUrl(prod.imageUrl || '');
    setProductFormOpen(true);
  };

  // Handle Product Form Submit (Add or Edit)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    setFormSubmitting(true);
    try {
      const numCost = parseFloat(costPrice) || 0;
      const numSell = parseFloat(sellingPrice) || 0;
      const numTax = parseFloat(taxRate) || 0;
      const numMin = parseInt(minStockAlert, 10) || 0;
      const numMax = parseInt(maxStockLevel, 10) || 100;
      const numInitStock = parseInt(initialStock, 10) || 0;

      if (editingProduct) {
        // Update product master metadata (currentStock is NOT overwritten here!)
        await updateProduct(editingProduct.id, {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || undefined,
          category,
          unit,
          costPrice: numCost,
          sellingPrice: numSell,
          taxRate: numTax,
          minStockAlert: numMin,
          maxStockLevel: numMax,
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        });
      } else {
        // Create new master product record
        const newProd = await createProduct({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || undefined,
          category,
          unit,
          costPrice: numCost,
          sellingPrice: numSell,
          taxRate: numTax,
          currentStock: numInitStock,
          minStockAlert: numMin,
          maxStockLevel: numMax,
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          status: 'active',
        });

        // Automatically record initial stock transaction if initial stock > 0
        if (numInitStock > 0 && newProd?.id) {
          await createStockTransaction({
            productId: newProd.id,
            productName: newProd.name,
            sku: newProd.sku,
            quantity: numInitStock,
            direction: 'in',
            type: 'initial_stock',
            reference: `INIT-${newProd.sku}`,
            referenceType: 'initial',
            date: new Date().toISOString(),
            cost: numCost,
            totalCost: numCost * numInitStock,
            userId: 'user-default-admin',
            userName: 'System Administrator',
            notes: 'Initial opening inventory balance upon product creation',
            status: 'active',
          });
        }
      }
      setProductFormOpen(false);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Safe Delete Product with Guardrail
  const handleSafeDeleteProduct = async (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const stock = productStocks[product.id] ?? product.currentStock ?? 0;
    const hasTransactions = stockTransactions.some((t) => t.productId === product.id && !t.isDeleted);
    const hasSales = sales.some((s) => !s.isDeleted && s.items?.some((it) => it.productId === product.id));
    const hasPurchases = purchases.some((p) => !p.isDeleted && p.items?.some((it) => it.productId === product.id));

    if (stock > 0) {
      setDeleteErrorMsg(
        `Cannot delete "${product.name}". The product currently has ${stock} ${product.unit} on hand. Please write off or transfer stock before archiving.`
      );
      return;
    }

    if (hasSales || hasPurchases) {
      setDeleteErrorMsg(
        `Cannot delete "${product.name}" because historical sales invoices or purchase orders reference this SKU. The item should instead be disabled (Inactive).`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate and remove SKU "${product.sku}"?`
    );
    if (confirmed) {
      await softDeleteProduct(product.id);
    }
  };

  // Stock Adjustment Handler
  const handleConfirmAdjustment = async (params: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    direction: 'in' | 'out';
    type: StockTransactionType;
    cost: number;
    reference: string;
    notes: string;
  }) => {
    const prod = products.find((p) => p.id === params.productId);
    if (!prod) throw new Error('Product not found.');

    const currentStockOnHand = productStocks[prod.id] ?? prod.currentStock ?? 0;
    if (params.direction === 'out') {
      const validation = validateStockDeduction(
        prod.name,
        currentStockOnHand,
        params.quantity,
        allowNegativeInventory
      );
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    // Commit the immutable stock transaction
    await createStockTransaction({
      productId: params.productId,
      productName: params.productName,
      sku: params.sku,
      quantity: params.quantity,
      direction: params.direction,
      type: params.type,
      reference: params.reference,
      referenceType: 'stock_adjustment',
      date: new Date().toISOString(),
      cost: params.cost,
      totalCost: params.cost * params.quantity,
      userId: 'user-default-admin',
      userName: 'Chief Administrator',
      notes: params.notes,
      status: 'active',
    });
  };

  // Open Category Modals
  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatCode(`CAT-${Math.floor(100 + Math.random() * 900)}`);
    setCatDescription('');
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatCode(cat.code);
    setCatDescription(cat.description || '');
    setCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) return;

    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        name: catName.trim(),
        code: catCode.trim().toUpperCase(),
        description: catDescription.trim() || undefined,
      });
    } else {
      await createCategory({
        name: catName.trim(),
        code: catCode.trim().toUpperCase(),
        description: catDescription.trim() || undefined,
        status: 'active',
      });
    }
    setCategoryModalOpen(false);
  };

  const handleSafeDeleteCategory = async (cat: Category) => {
    const linkedProducts = products.filter((p) => p.category === cat.name && !p.isDeleted);
    if (linkedProducts.length > 0) {
      setDeleteErrorMsg(
        `Cannot delete Category "${cat.name}". There are currently ${linkedProducts.length} active product(s) assigned to this category.`
      );
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete category "${cat.name}"?`);
    if (confirmed) {
      await softDeleteCategory(cat.id);
    }
  };

  // Columns for Products Catalog DataTable
  const productColumns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product / SKU / Barcode',
      sortable: true,
      render: (item) => {
        return (
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-10 h-10 rounded-md object-cover border border-slate-200 bg-slate-100 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer" onClick={() => setViewingProduct(item)}>
                  {item.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {item.sku}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="px-1.5 py-0.2 rounded bg-slate-50 text-slate-600 border border-slate-200 font-medium">
                  {item.category}
                </span>
                {item.barcode && (
                  <span className="flex items-center gap-1 font-mono text-slate-400">
                    <Barcode className="w-3 h-3" />
                    {item.barcode}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'currentStock',
      header: 'Stock On Hand',
      sortable: true,
      align: 'center',
      render: (item) => {
        const stock = productStocks[item.id] ?? item.currentStock ?? 0;
        const isLow = stock <= item.minStockAlert;
        const isZero = stock <= 0;
        return (
          <div className="inline-flex items-center gap-1.5 font-mono">
            <span
              className={`font-bold px-2 py-0.5 rounded text-xs ${
                isZero
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : isLow
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {stock} {item.unit}
            </span>
            {isLow && (
              <span title={`Low stock alert! Minimum safety threshold is ${item.minStockAlert} ${item.unit}`}>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'costPrice',
      header: 'Cost Price',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-slate-600">
          {formatCurrency(item.costPrice, currency, currencySymbol)}
        </span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold text-emerald-600">
          {formatCurrency(item.sellingPrice, currency, currencySymbol)}
        </span>
      ),
    },
    {
      key: 'taxRate',
      header: 'Tax Rate',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-mono text-slate-600">{item.taxRate}%</span>,
    },
  ];

  // Filtered Stock Transactions for Transactions Tab
  const filteredTransactions = useMemo(() => {
    return stockTransactions.filter((t) => {
      if (t.isDeleted) return false;
      if (transactionTypeFilter !== 'all' && t.type !== transactionTypeFilter) {
        return false;
      }
      if (transactionSearchQuery.trim()) {
        const query = transactionSearchQuery.toLowerCase();
        const matchProd = t.productName?.toLowerCase().includes(query);
        const matchSku = t.sku?.toLowerCase().includes(query);
        const matchRef = t.reference?.toLowerCase().includes(query);
        const matchUser = t.userName?.toLowerCase().includes(query);
        if (!matchProd && !matchSku && !matchRef && !matchUser) return false;
      }
      return true;
    });
  }, [stockTransactions, transactionTypeFilter, transactionSearchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products, Categories & Inventory"
        subtitle={`Transaction-based inventory management for ${currentTenant?.name} (${currentTenant?.code})`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const itemsToPrint = (displayedProducts.length > 0 ? displayedProducts : products).map((p) => ({
                  name: p.name,
                  sku: p.sku,
                  barcode: p.barcode || p.sku,
                  sellingPrice: p.sellingPrice,
                  category: p.category,
                  unit: p.unit,
                  quantity: 1,
                }));
                if (itemsToPrint.length > 0) {
                  printBarcodeLabels(itemsToPrint, currentTenant);
                }
              }}
              className="text-xs font-semibold"
            >
              <Barcode className="w-4 h-4 mr-1 text-slate-700" />
              Print Barcodes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdjustmentTargetProduct(null);
                setAdjustModalOpen(true);
              }}
            >
              <SlidersHorizontal className="w-4 h-4 mr-1 text-indigo-600" />
              Adjust Stock
            </Button>
            <Button size="sm" onClick={openCreateProductModal}>
              <Plus className="w-4 h-4 mr-1" />
              Add Product SKU
            </Button>
          </div>
        }
      />

      {/* Top Inventory KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active SKUs</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{products.length}</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{categories.length} configured categories</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory Valuation</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrency(totalInventoryValuation, currency, currencySymbol)}
            </div>
            <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">Derived from real stock & cost</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low Stock Warnings</span>
            <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{lowStockProductsCount}</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">At or below safety threshold</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Out of Stock</span>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{outOfStockProductsCount}</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Zero physical availability</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            Products Catalog ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Stock Movements & Adjustments ({stockTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Product Categories ({categories.length})
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="hidden sm:flex items-center gap-2 pb-1">
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 font-medium ${
                lowStockOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-amber-700' : 'text-slate-400'}`} />
              Low Stock Only ({lowStockProductsCount})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: PRODUCTS CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <Select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...categories.map((c) => ({ value: c.name, label: c.name })),
                ]}
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {displayedProducts.length} of {products.length} catalog items
            </span>
          </div>

          <DataTable<Product>
            columns={productColumns}
            data={displayedProducts}
            totalCount={productsCount}
            page={productsPage}
            pageSize={productsPageSize}
            totalPages={productsTotalPages}
            loading={productsLoading}
            searchQuery={productSearchQuery}
            onSearchChange={setProductSearchQuery}
            statusFilter={productStatusFilter}
            onStatusFilterChange={setProductStatusFilter}
            sortBy={productSortBy}
            sortDirection={productSortDirection}
            onSortChange={(field) => {
              if (productSortBy === field) {
                setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setProductSortBy(field);
                setProductSortDirection('asc');
              }
            }}
            onPageChange={setProductsPage}
            onPageSizeChange={setProductsPageSize}
            onView={(item) => setViewingProduct(item)}
            onEdit={openEditProductModal}
            onToggleStatus={toggleProductStatus}
            onDelete={handleSafeDeleteProduct}
            title="Product & SKU Directory"
            description="Transaction-derived inventory balances with live safety threshold alerts"
          />
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENTS & ADJUSTMENTS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search SKU, Product, or Ref #..."
                  value={transactionSearchQuery}
                  onChange={(e) => setTransactionSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <select
                value={transactionTypeFilter}
                onChange={(e) => setTransactionTypeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">All Movement Types</option>
                <option value="purchase">Purchases (Stock In)</option>
                <option value="sale">Sales (Stock Out)</option>
                <option value="adjustment_in">Adjustments In (+)</option>
                <option value="adjustment_out">Adjustments Out (-)</option>
                <option value="initial_stock">Initial Stock</option>
                <option value="sale_return">Sales Returns</option>
                <option value="purchase_return">Purchase Returns</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setAdjustmentTargetProduct(null);
                setAdjustModalOpen(true);
              }}
            >
              <SlidersHorizontal className="w-4 h-4 mr-1 text-indigo-400" />
              New Stock Adjustment
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Total Valuation</th>
                  <th className="py-3 px-4">Operator & Notes</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No stock movement transactions match your query.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const matchedProd = products.find((p) => p.id === tx.productId) || {
                      name: tx.productName,
                      sku: tx.sku,
                      unit: 'pcs',
                      category: 'General',
                    } as any;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{tx.productName}</div>
                          <span className="font-mono text-[10px] text-slate-500">{tx.sku}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              tx.direction === 'in'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {tx.direction === 'in' ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-rose-600" />
                            )}
                            {tx.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {tx.reference}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={tx.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                            {tx.direction === 'in' ? '+' : '-'}{tx.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                          {formatCurrency(tx.cost, currency, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(tx.totalCost, currency, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-[220px]">
                          <span className="font-medium text-slate-700 block truncate">{tx.userName}</span>
                          {tx.notes && <span className="text-[11px] text-slate-400 block truncate">{tx.notes}</span>}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => printStockAdjustmentSlip(tx, matchedProd, currentTenant)}
                            title="Print Stock Adjustment Slip"
                            className="text-indigo-600 hover:bg-indigo-50 h-7 w-7 p-0 inline-flex items-center justify-center"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Product Categories</h3>
              <p className="text-xs text-slate-500 mt-0.5">Organize items for catalog navigation, taxes, and reporting.</p>
            </div>
            <Button size="sm" onClick={openCreateCategoryModal}>
              <Plus className="w-4 h-4 mr-1" />
              Add Category
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = products.filter((p) => p.category === cat.name && !p.isDeleted).length;
              return (
                <div
                  key={cat.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                        <span className="font-mono text-[11px] text-indigo-600 font-semibold">{cat.code}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          cat.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {cat.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {cat.description || 'No descriptive notes entered for this category.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      <strong>{count}</strong> product SKU(s)
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => openEditCategoryModal(cat)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => toggleCategoryStatus(cat.id, cat.status === 'active' ? 'inactive' : 'active')}
                      >
                        {cat.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleSafeDeleteCategory(cat)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Create / Edit Modal */}
      <Modal
        isOpen={productFormOpen}
        onClose={() => setProductFormOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Product SKU'}
        description="Master inventory specifications and pricing catalog."
        maxWidth="lg"
      >
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Product Name"
              placeholder="e.g. Industrial Grade Hydraulic Pump"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Stock Keeping Unit (SKU)"
              placeholder="e.g. PUMP-HYD-400"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Barcode / UPC"
              placeholder="e.g. 89012345678"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categories
                .filter((c) => c.status === 'active' && !c.isDeleted)
                .map((c) => ({ value: c.name, label: c.name }))}
            />
            <Select
              label="Measurement Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              options={[
                { value: 'pcs', label: 'Pieces (pcs)' },
                { value: 'box', label: 'Box' },
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'm', label: 'Meters (m)' },
                { value: 'l', label: 'Liters (l)' },
                { value: 'set', label: 'Set' },
                { value: 'pack', label: 'Pack' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={`Purchase Cost (${currencySymbol})`}
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
            <Input
              label={`Selling Price (${currencySymbol})`}
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.1"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label={editingProduct ? 'Current Stock (Read-Only)' : 'Initial Stock Quantity'}
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                disabled={!!editingProduct}
                required
              />
              {editingProduct && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Stock is transaction-derived. Use Stock Adjustment to modify.
                </span>
              )}
            </div>
            <Input
              label="Min Safety Stock Threshold"
              type="number"
              min="0"
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value)}
              required
            />
            <Input
              label="Max Warehouse Capacity"
              type="number"
              min="0"
              value={maxStockLevel}
              onChange={(e) => setMaxStockLevel(e.target.value)}
            />
          </div>

          <Input
            label="Product Image URL"
            placeholder="https://images.unsplash.com/..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />

          <Input
            label="Technical Description / Notes"
            placeholder="e.g. Continuous high-pressure duty specifications, temperature ratings..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setProductFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={formSubmitting}>
              {editingProduct ? 'Update Product Record' : 'Save Product SKU'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Create / Edit Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create Product Category'}
        description="Categories group products for catalogs and reporting."
        maxWidth="md"
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Heavy Machinery, Electronics..."
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <Input
            label="Category Code"
            placeholder="e.g. CAT-MACH"
            value={catCode}
            onChange={(e) => setCatCode(e.target.value.toUpperCase())}
            required
          />
          <Input
            label="Description"
            placeholder="e.g. Hydraulic actuators and continuous duty motors"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Product Detailed Inspection Modal */}
      <ProductDetailModal
        product={viewingProduct}
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        transactions={stockTransactions}
        sales={sales}
        purchases={purchases}
        currentStock={viewingProduct ? (productStocks[viewingProduct.id] ?? viewingProduct.currentStock ?? 0) : 0}
        currencySymbol={currencySymbol}
        currency={currency}
        onAdjustStock={(prod) => {
          setViewingProduct(null);
          setAdjustmentTargetProduct(prod);
          setAdjustModalOpen(true);
        }}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        products={products}
        preselectedProduct={adjustmentTargetProduct}
        productStocks={productStocks}
        currencySymbol={currencySymbol}
        currency={currency}
        allowNegativeInventory={allowNegativeInventory}
        onConfirmAdjustment={handleConfirmAdjustment}
      />

      {/* Safe Delete Guardrail Alert Modal */}
      {deleteErrorMsg && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteErrorMsg(null)}
          title="Operation Blocked by ERP Integrity Guard"
          description="Deletion prevented due to active transactional integrity rules."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">Safety Constraint Violation</p>
                <p>{deleteErrorMsg}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setDeleteErrorMsg(null)}>
                Acknowledge
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
