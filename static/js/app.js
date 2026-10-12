/**
 * Dapur MBG - Core Application Controller
 * Handles UI interactions, API communications, CRUD actions, and reactive updates
 */

const AppState = {
  currentPeriod: 'today',
  customDate: new Date().toISOString().split('T')[0],
  activeTab: 'dashboard',
  settings: {},
  stats: null,
  purchases: [],
  stockOut: [],
  mutations: [],
  inventory: [],
  waste: [],
  finances: []
};

// Preset bahan pangan umum dapur SPPG MBG untuk memudahkan pegawai
const PRESET_INGREDIENTS = [
  { name: 'Beras Rojolele Super', cat: 'Karbohidrat', unit: 'kg', price: 14500 },
  { name: 'Dada Ayam Fillet Segar', cat: 'Protein Hewani', unit: 'kg', price: 38000 },
  { name: 'Telur Ayam Negeri', cat: 'Protein Hewani', unit: 'kg', price: 27000 },
  { name: 'Daging Sapi Segar', cat: 'Protein Hewani', unit: 'kg', price: 125000 },
  { name: 'Ikan Kembung Segar', cat: 'Protein Hewani', unit: 'kg', price: 32000 },
  { name: 'Tempe Daun Tradisional', cat: 'Protein Nabati', unit: 'potong', price: 2000 },
  { name: 'Tahu Putih Segar', cat: 'Protein Nabati', unit: 'potong', price: 1500 },
  { name: 'Wortel Brastagi', cat: 'Sayuran', unit: 'kg', price: 12000 },
  { name: 'Bayam Hijau Segar', cat: 'Sayuran', unit: 'ikat', price: 3000 },
  { name: 'Buncis Hijau Segar', cat: 'Sayuran', unit: 'kg', price: 15000 },
  { name: 'Labu Siam Segar', cat: 'Sayuran', unit: 'kg', price: 8000 },
  { name: 'Buah Pisang Ambon', cat: 'Buah-buahan', unit: 'buah', price: 1500 },
  { name: 'Buah Jeruk Manis', cat: 'Buah-buahan', unit: 'kg', price: 18000 },
  { name: 'Buah Semangka Merah', cat: 'Buah-buahan', unit: 'kg', price: 9000 },
  { name: 'Susu UHT MBG 125ml', cat: 'Susu & Pelengkap', unit: 'kotak', price: 3500 },
  { name: 'Minyak Goreng Sawit', cat: 'Minyak & Bumbu', unit: 'liter', price: 17000 },
  { name: 'Bawang Merah Segar', cat: 'Minyak & Bumbu', unit: 'kg', price: 35000 },
  { name: 'Bawang Putih Kupas', cat: 'Minyak & Bumbu', unit: 'kg', price: 38000 },
  { name: 'Garam Beriodium', cat: 'Minyak & Bumbu', unit: 'bks', price: 3500 }
];

// Utility Format Currency IDR
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

// Utility Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadSettings();
  loadDashboard();
  renderPresetChips();
  renderStockOutPresetChips();
  
  // Set default dates on all date inputs
  document.querySelectorAll('input[type="date"]').forEach(inp => {
    if (!inp.value) inp.value = AppState.customDate;
  });
});

// Setup Event Listeners
function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.app-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Period Filter Buttons (Hari Ini, Minggu Ini, Bulan Ini, Semua)
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentPeriod = btn.getAttribute('data-period');
      refreshCurrentView();
    });
  });

  // Modal Close Buttons
  document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // Modal Backdrop Click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });
  });

  // Purchase Form Auto Calculation (Qty * Unit Price)
  const pQty = document.getElementById('p-qty');
  const pPrice = document.getElementById('p-price');
  const pTotal = document.getElementById('p-total');
  function calcPurchaseTotal() {
    const q = parseFloat(pQty.value) || 0;
    const p = parseFloat(pPrice.value) || 0;
    pTotal.value = (q * p).toString();
  }
  if (pQty && pPrice) {
    pQty.addEventListener('input', calcPurchaseTotal);
    pPrice.addEventListener('input', calcPurchaseTotal);
  }

  // Stock Out Form Auto Calculation (Qty * Unit Price)
  const soQty = document.getElementById('so-qty');
  const soPrice = document.getElementById('so-price');
  const soTotal = document.getElementById('so-total');
  function calcStockOutTotal() {
    const q = parseFloat(soQty.value) || 0;
    const p = parseFloat(soPrice.value) || 0;
    soTotal.value = (q * p).toString();
  }
  if (soQty && soPrice) {
    soQty.addEventListener('input', calcStockOutTotal);
    soPrice.addEventListener('input', calcStockOutTotal);
  }

  // Search & Filter event listeners
  const searchPurchases = document.getElementById('search-purchases');
  const filterCatPurchases = document.getElementById('filter-cat-purchases');
  if (searchPurchases) searchPurchases.addEventListener('input', loadPurchases);
  if (filterCatPurchases) filterCatPurchases.addEventListener('change', loadPurchases);

  const searchStockOut = document.getElementById('search-stock-out');
  const filterCatStockOut = document.getElementById('filter-cat-stock-out');
  if (searchStockOut) searchStockOut.addEventListener('input', loadStockOut);
  if (filterCatStockOut) filterCatStockOut.addEventListener('change', loadStockOut);

  const searchMutations = document.getElementById('search-mutations');
  if (searchMutations) searchMutations.addEventListener('input', loadStockMutations);

  const searchInv = document.getElementById('search-inventory');
  const filterCondInv = document.getElementById('filter-cond-inventory');
  if (searchInv) searchInv.addEventListener('input', loadInventory);
  if (filterCondInv) filterCondInv.addEventListener('change', loadInventory);

  const searchWaste = document.getElementById('search-waste');
  const filterReasonWaste = document.getElementById('filter-reason-waste');
  if (searchWaste) searchWaste.addEventListener('input', loadWaste);
  if (filterReasonWaste) filterReasonWaste.addEventListener('change', loadWaste);

  const searchFinance = document.getElementById('search-finance');
  const filterTypeFinance = document.getElementById('filter-type-finance');
  if (searchFinance) searchFinance.addEventListener('input', loadFinances);
  if (filterTypeFinance) filterTypeFinance.addEventListener('change', loadFinances);

  // Report Period Selector
  const reportPeriodSelect = document.getElementById('report-period-select');
  if (reportPeriodSelect) {
    reportPeriodSelect.addEventListener('change', () => {
      MBGReports.loadRecap(reportPeriodSelect.value);
    });
  }
}

// Switch Active View
function switchTab(tab) {
  AppState.activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tab);
  });

  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tab}`);
  });

  // Close mobile sidebar if open
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  refreshCurrentView();
}

function refreshCurrentView() {
  switch (AppState.activeTab) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'purchases':
      loadPurchases();
      break;
    case 'stock-out':
      loadStockOut();
      break;
    case 'mutations':
      loadStockMutations();
      break;
    case 'inventory':
      loadInventory();
      break;
    case 'waste':
      loadWaste();
      break;
    case 'finances':
      loadFinances();
      break;
    case 'reports':
      const p = document.getElementById('report-period-select') ? document.getElementById('report-period-select').value : AppState.currentPeriod;
      MBGReports.loadRecap(p);
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// ==========================================
// 1. DASHBOARD CONTROLLER
// ==========================================
async function loadDashboard() {
  try {
    const res = await fetch(`/api/stats?period=${AppState.currentPeriod}&custom_date=${AppState.customDate}`);
    if (!res.ok) throw new Error('Gagal memuat statistik');
    const data = await res.json();
    AppState.stats = data;

    // 1. Saldo Kas & Keuangan
    const cf = data.cash_flow;
    document.getElementById('dash-balance').textContent = formatRupiah(cf.current_balance);
    document.getElementById('dash-income').textContent = formatRupiah(cf.period_income);
    document.getElementById('dash-expense').textContent = formatRupiah(cf.period_expense);
    
    // 2. Untung / Rugi (Surplus / Defisit Periode)
    const profitEl = document.getElementById('dash-profit');
    const profitBadge = document.getElementById('dash-profit-badge');
    const isProfit = cf.period_profit_loss >= 0;
    
    profitEl.textContent = (isProfit ? '+ ' : '- ') + formatRupiah(Math.abs(cf.period_profit_loss));
    profitEl.style.color = isProfit ? '#15803d' : '#b91c1c';
    profitBadge.textContent = isProfit ? 'Surplus (Untung)' : 'Defisit (Overbudget/Rugi)';
    profitBadge.className = isProfit ? 'badge-surplus' : 'badge-deficit';

    // 3. Logistik Bahan & Limbah
    document.getElementById('dash-purchases-spent').textContent = formatRupiah(data.purchases.total_spent);
    document.getElementById('dash-purchases-qty').textContent = `${data.purchases.total_qty.toLocaleString('id-ID')} unit/kg`;

    // Barang Keluar
    if (data.stock_out) {
      const soSpentEl = document.getElementById('dash-stock-out-spent');
      const soQtyEl = document.getElementById('dash-stock-out-qty');
      if (soSpentEl) soSpentEl.textContent = formatRupiah(data.stock_out.total_value);
      if (soQtyEl) soQtyEl.textContent = `${data.stock_out.total_qty.toLocaleString('id-ID')} unit/kg dikeluarkan`;
    }

    document.getElementById('dash-inventory-count').textContent = `${data.inventory.item_count} Item`;
    document.getElementById('dash-waste-loss').textContent = formatRupiah(data.waste.total_loss);
    document.getElementById('dash-waste-qty').textContent = `${data.waste.total_waste_qty} unit/kg dibuang`;

    // 4. Target Porsi MBG Info Box
    const nut = data.nutrition_metrics;
    document.getElementById('dash-target-portions').textContent = `${nut.target_portions.toLocaleString('id-ID')} Porsi`;
    document.getElementById('dash-budget-per-portion').textContent = formatRupiah(nut.budget_per_portion);
    document.getElementById('dash-actual-portion-cost').textContent = formatRupiah(nut.actual_food_cost_per_portion);
    document.getElementById('dash-efficiency-pct').textContent = `${nut.cost_efficiency}% Efisiensi`;

    // 5. Render Canvas Charts
    MBGCharts.renderFinanceBar('canvas-finance-bar', cf.period_income, cf.period_expense, cf.period_profit_loss);

    const catData = data.purchases_by_category.map(c => ({
      label: c.category,
      value: c.total_amount
    }));
    MBGCharts.renderDoughnut('canvas-category-doughnut', catData);

  } catch (err) {
    console.error('loadDashboard error:', err);
  }
}

// ==========================================
// 2. PEMBELIAN BAHAN PANGAN CONTROLLER
// ==========================================
async function loadPurchases() {
  try {
    const search = document.getElementById('search-purchases') ? document.getElementById('search-purchases').value : '';
    const cat = document.getElementById('filter-cat-purchases') ? document.getElementById('filter-cat-purchases').value : 'ALL';
    
    let url = `/api/purchases?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (cat && cat !== 'ALL') url += `&category=${encodeURIComponent(cat)}`;

    const res = await fetch(url);
    const list = await res.json();
    AppState.purchases = list;

    // Hitung otomatis total pembelian (kuantitas dan total biaya)
    const totalQty = list.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
    const totalSpent = list.reduce((sum, p) => sum + (parseFloat(p.total_price) || 0), 0);

    const sumCountEl = document.getElementById('purchases-sum-count');
    const sumQtyEl = document.getElementById('purchases-sum-qty');
    const sumTotalEl = document.getElementById('purchases-sum-total');
    if (sumCountEl) sumCountEl.textContent = `${list.length} Transaksi`;
    if (sumQtyEl) sumQtyEl.textContent = `${totalQty.toLocaleString('id-ID')} unit/kg`;
    if (sumTotalEl) sumTotalEl.textContent = formatRupiah(totalSpent);

    const footQtyEl = document.getElementById('purchases-foot-qty');
    const footTotalEl = document.getElementById('purchases-foot-total');
    if (footQtyEl) footQtyEl.textContent = `${totalQty.toLocaleString('id-ID')} unit/kg`;
    if (footTotalEl) footTotalEl.textContent = formatRupiah(totalSpent);

    const tbody = document.getElementById('purchases-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #94a3b8;">Belum ada catatan pembelian bahan pangan</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((p, idx) => `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td><strong>${p.date}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${p.item_name}</div>
          ${p.notes ? `<small style="color: #64748b;">${p.notes}</small>` : ''}
        </td>
        <td><span class="badge ${getCategoryBadgeClass(p.category)}">${p.category}</span></td>
        <td class="text-right font-mono" style="font-weight: 600;">${p.quantity} ${p.unit}</td>
        <td class="text-right font-mono">${formatRupiah(p.unit_price)}</td>
        <td class="text-right font-mono" style="font-weight: 700; color: #065f46;">${formatRupiah(p.total_price)}</td>
        <td>${p.supplier || '-'}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="deletePurchase(${p.id})" title="Hapus catatan" style="color: #dc2626;">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('loadPurchases error:', err);
  }
}

// ==========================================
// 2b. BARANG KELUAR (PEMAKAIAN MASAK) CONTROLLER
// ==========================================
async function loadStockOut() {
  try {
    const search = document.getElementById('search-stock-out') ? document.getElementById('search-stock-out').value : '';
    const cat = document.getElementById('filter-cat-stock-out') ? document.getElementById('filter-cat-stock-out').value : 'ALL';
    
    let url = `/api/stock-out?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (cat && cat !== 'ALL') url += `&category=${encodeURIComponent(cat)}`;

    const res = await fetch(url);
    const list = await res.json();
    AppState.stockOut = list;

    // Setiap barang yang keluar ditotalkan secara otomatis (kuantitas dan total nilai)
    const totalQty = list.reduce((sum, so) => sum + (parseFloat(so.quantity) || 0), 0);
    const totalSpent = list.reduce((sum, so) => sum + (parseFloat(so.total_price) || 0), 0);

    const sumCountEl = document.getElementById('so-sum-count');
    const sumQtyEl = document.getElementById('so-sum-qty');
    const sumTotalEl = document.getElementById('so-sum-total');
    if (sumCountEl) sumCountEl.textContent = `${list.length} Transaksi`;
    if (sumQtyEl) sumQtyEl.textContent = `${totalQty.toLocaleString('id-ID')} unit/kg`;
    if (sumTotalEl) sumTotalEl.textContent = formatRupiah(totalSpent);

    const footQtyEl = document.getElementById('so-foot-qty');
    const footTotalEl = document.getElementById('so-foot-total');
    if (footQtyEl) footQtyEl.textContent = `${totalQty.toLocaleString('id-ID')} unit/kg`;
    if (footTotalEl) footTotalEl.textContent = formatRupiah(totalSpent);

    const tbody = document.getElementById('stock-out-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;">Belum ada catatan pengeluaran bahan pangan</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((so, idx) => `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td><strong>${so.date}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${so.item_name}</div>
          ${so.notes ? `<small style="color: #64748b;">${so.notes}</small>` : ''}
        </td>
        <td><span class="badge ${getCategoryBadgeClass(so.category)}">${so.category}</span></td>
        <td class="text-right font-mono" style="font-weight: 600;">${so.quantity} ${so.unit}</td>
        <td class="text-right font-mono">${formatRupiah(so.unit_price)}</td>
        <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">${formatRupiah(so.total_price)}</td>
        <td>
          <div style="font-weight: 600;">${so.purpose || 'Menu MBG'}</div>
          ${so.recipient_school ? `<small style="color: #64748b;">Sekolah: ${so.recipient_school}</small>` : ''}
        </td>
        <td>${so.chef_or_staff || '-'}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="deleteStockOut(${so.id})" title="Hapus catatan" style="color: #dc2626;">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('loadStockOut error:', err);
  }
}

function openAddStockOutModal() {
  document.getElementById('modal-add-stock-out').classList.add('active');
  document.getElementById('so-date').value = AppState.customDate;
  document.getElementById('so-name').focus();
}

function renderStockOutPresetChips() {
  const container = document.getElementById('stock-out-preset-chips');
  if (!container) return;

  container.innerHTML = PRESET_INGREDIENTS.map(item => `
    <span class="preset-chip" onclick="applyPresetStockOut('${item.name}')">
      + ${item.name}
    </span>
  `).join('');
}

function applyPresetStockOut(name) {
  const found = PRESET_INGREDIENTS.find(i => i.name === name);
  if (!found) return;
  document.getElementById('so-name').value = found.name;
  document.getElementById('so-category').value = found.cat;
  document.getElementById('so-unit').value = found.unit;
  document.getElementById('so-price').value = found.price;
  
  const q = parseFloat(document.getElementById('so-qty').value) || 1;
  document.getElementById('so-total').value = (q * found.price).toString();
}

async function handleSaveStockOut(e) {
  e.preventDefault();
  const date = document.getElementById('so-date').value;
  const item_name = document.getElementById('so-name').value.trim();
  const category = document.getElementById('so-category').value;
  const quantity = parseFloat(document.getElementById('so-qty').value) || 0;
  const unit = document.getElementById('so-unit').value;
  const unit_price = parseFloat(document.getElementById('so-price').value) || 0;
  const total_price = parseFloat(document.getElementById('so-total').value) || (quantity * unit_price);
  const purpose = document.getElementById('so-purpose').value.trim();
  const recipient_school = document.getElementById('so-recipient').value.trim();
  const chef_or_staff = document.getElementById('so-chef').value.trim();
  const notes = document.getElementById('so-notes').value.trim();

  if (!item_name || quantity <= 0) {
    showToast('Mohon isi nama bahan pangan dan kuantitas pengeluaran', 'error');
    return;
  }

  try {
    const res = await fetch('/api/stock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, item_name, category, quantity, unit, unit_price, total_price, purpose, recipient_school, chef_or_staff, notes
      })
    });
    if (!res.ok) throw new Error('Gagal mencatat barang keluar');
    
    showToast('Pengeluaran barang berhasil dicatat dan nilai otomatis dihitung!');
    closeAllModals();
    document.getElementById('form-add-stock-out').reset();
    loadStockOut();
    loadDashboard();
    if (AppState.activeTab === 'inventory') loadInventory();
    if (AppState.activeTab === 'mutations') loadStockMutations();
  } catch (err) {
    showToast('Gagal mencatat pengeluaran: ' + err.message, 'error');
  }
}

async function deleteStockOut(id) {
  if (!confirm('Yakin ingin menghapus catatan barang keluar ini?')) return;
  try {
    const res = await fetch(`/api/stock-out/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus');
    showToast('Catatan barang keluar dihapus');
    loadStockOut();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ==========================================
// 2c. MUTASI KELUAR MASUK BARANG CONTROLLER
// ==========================================
async function loadStockMutations() {
  try {
    const search = document.getElementById('search-mutations') ? document.getElementById('search-mutations').value : '';
    let url = `/api/stock-mutations?period=${AppState.currentPeriod}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    const data = await res.json();
    AppState.mutations = data.items || [];
    const t = data.totals || {};

    // Update Summary Cards
    const sumInQty = document.getElementById('mut-sum-in-qty');
    const sumInVal = document.getElementById('mut-sum-in-val');
    const sumOutQty = document.getElementById('mut-sum-out-qty');
    const sumOutVal = document.getElementById('mut-sum-out-val');
    const sumWasteQty = document.getElementById('mut-sum-waste-qty');
    const sumWasteLoss = document.getElementById('mut-sum-waste-loss');
    const sumRemQty = document.getElementById('mut-sum-rem-qty');
    const sumRemVal = document.getElementById('mut-sum-rem-val');

    if (sumInQty) sumInQty.textContent = `${(t.grand_in_qty || 0).toLocaleString('id-ID')} unit`;
    if (sumInVal) sumInVal.textContent = formatRupiah(t.grand_in_value);
    if (sumOutQty) sumOutQty.textContent = `${(t.grand_out_qty || 0).toLocaleString('id-ID')} unit`;
    if (sumOutVal) sumOutVal.textContent = formatRupiah(t.grand_out_value);
    if (sumWasteQty) sumWasteQty.textContent = `${(t.grand_waste_qty || 0).toLocaleString('id-ID')} unit`;
    if (sumWasteLoss) sumWasteLoss.textContent = formatRupiah(t.grand_waste_loss);
    if (sumRemQty) sumRemQty.textContent = `${(t.grand_remaining_qty || 0).toLocaleString('id-ID')} unit`;
    if (sumRemVal) sumRemVal.textContent = `Estimasi: ${formatRupiah(t.grand_remaining_value)}`;

    // Update Table Foot
    const footInQty = document.getElementById('mut-foot-in-qty');
    const footInVal = document.getElementById('mut-foot-in-val');
    const footOutQty = document.getElementById('mut-foot-out-qty');
    const footOutVal = document.getElementById('mut-foot-out-val');
    const footWasteQty = document.getElementById('mut-foot-waste-qty');
    const footRemQty = document.getElementById('mut-foot-rem-qty');

    if (footInQty) footInQty.textContent = (t.grand_in_qty || 0).toLocaleString('id-ID');
    if (footInVal) footInVal.textContent = formatRupiah(t.grand_in_value);
    if (footOutQty) footOutQty.textContent = (t.grand_out_qty || 0).toLocaleString('id-ID');
    if (footOutVal) footOutVal.textContent = formatRupiah(t.grand_out_value);
    if (footWasteQty) footWasteQty.textContent = (t.grand_waste_qty || 0).toLocaleString('id-ID');
    if (footRemQty) footRemQty.textContent = (t.grand_remaining_qty || 0).toLocaleString('id-ID');

    const tbody = document.getElementById('mutations-table-body');
    if (!tbody) return;

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 24px; color: #94a3b8;">Belum ada catatan mutasi stok pada periode ini</td></tr>`;
      return;
    }

    tbody.innerHTML = data.items.map((m, idx) => `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td><strong>${m.item_name}</strong></td>
        <td><span class="badge ${getCategoryBadgeClass(m.category)}">${m.category}</span></td>
        <td>${m.unit}</td>
        <td class="text-right font-mono" style="color: #16a34a; font-weight: 700;">${m.in_qty}</td>
        <td class="text-right font-mono">${formatRupiah(m.in_value)}</td>
        <td class="text-right font-mono" style="color: #0284c7; font-weight: 700;">${m.out_qty}</td>
        <td class="text-right font-mono">${formatRupiah(m.out_value)}</td>
        <td class="text-right font-mono" style="color: #dc2626;">${m.waste_qty}</td>
        <td class="text-right font-mono" style="font-weight: 800; color: #d97706;">${m.remaining_qty}</td>
        <td class="text-center">
          <span class="badge" style="background: ${m.status_color === 'success' ? '#dcfce7' : m.status_color === 'warning' ? '#fef3c7' : '#fee2e2'}; color: ${m.status_color === 'success' ? '#15803d' : m.status_color === 'warning' ? '#b45309' : '#b91c1c'}; font-weight: 700;">
            ${m.status}
          </span>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('loadStockMutations error:', err);
  }
}

function openAddPurchaseModal() {
  document.getElementById('modal-add-purchase').classList.add('active');
  document.getElementById('p-date').value = AppState.customDate;
  document.getElementById('p-name').focus();
}

function renderPresetChips() {
  const container = document.getElementById('purchase-preset-chips');
  if (!container) return;

  container.innerHTML = PRESET_INGREDIENTS.map(item => `
    <span class="preset-chip" onclick="applyPresetIngredient('${item.name}')">
      + ${item.name}
    </span>
  `).join('');
}

function applyPresetIngredient(name) {
  const found = PRESET_INGREDIENTS.find(i => i.name === name);
  if (!found) return;
  document.getElementById('p-name').value = found.name;
  document.getElementById('p-category').value = found.cat;
  document.getElementById('p-unit').value = found.unit;
  document.getElementById('p-price').value = found.price;
  
  const q = parseFloat(document.getElementById('p-qty').value) || 1;
  document.getElementById('p-total').value = (q * found.price).toString();
}

async function handleSavePurchase(e) {
  e.preventDefault();
  const date = document.getElementById('p-date').value;
  const item_name = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value;
  const quantity = parseFloat(document.getElementById('p-qty').value) || 0;
  const unit = document.getElementById('p-unit').value;
  const unit_price = parseFloat(document.getElementById('p-price').value) || 0;
  const total_price = parseFloat(document.getElementById('p-total').value) || (quantity * unit_price);
  const supplier = document.getElementById('p-supplier').value.trim();
  const notes = document.getElementById('p-notes').value.trim();
  const auto_record_expense = document.getElementById('p-auto-expense').checked;

  if (!item_name || quantity <= 0) {
    showToast('Mohon isi nama bahan dan kuantitas dengan benar', 'error');
    return;
  }

  try {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, item_name, category, quantity, unit, unit_price, total_price, supplier, notes, auto_record_expense
      })
    });
    if (!res.ok) throw new Error('Gagal menyimpan data');
    
    showToast('Pembelian bahan pangan berhasil dicatat!');
    closeAllModals();
    document.getElementById('form-add-purchase').reset();
    document.getElementById('p-auto-expense').checked = true;
    loadPurchases();
    loadDashboard();
  } catch (err) {
    showToast('Gagal mencatat pembelian: ' + err.message, 'error');
  }
}

async function deletePurchase(id) {
  if (!confirm('Yakin ingin menghapus catatan pembelian bahan ini? (Transaksi pengeluaran terkait juga akan dihapus)')) return;
  try {
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus');
    showToast('Catatan pembelian dihapus');
    loadPurchases();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ==========================================
// 3. STOK SISA BAHAN (INVENTORY) CONTROLLER
// ==========================================
async function loadInventory() {
  try {
    const search = document.getElementById('search-inventory') ? document.getElementById('search-inventory').value : '';
    const cond = document.getElementById('filter-cond-inventory') ? document.getElementById('filter-cond-inventory').value : 'ALL';
    
    let url = `/api/inventory?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (cond && cond !== 'ALL') url += `&condition=${encodeURIComponent(cond)}`;

    const res = await fetch(url);
    const list = await res.json();
    AppState.inventory = list;

    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #94a3b8;">Belum ada data stok sisa dapur</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((inv, idx) => `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${inv.item_name}</div>
          <small style="color: #64748b;">Update: ${inv.updated_at ? inv.updated_at.substring(0, 10) : inv.date}</small>
        </td>
        <td><span class="badge ${getCategoryBadgeClass(inv.category)}">${inv.category}</span></td>
        <td class="text-right font-mono" style="font-weight: 800; font-size: 0.95rem; color: #065f46;">
          ${inv.remaining_qty} ${inv.unit}
        </td>
        <td>
          <span class="badge ${getConditionBadgeClass(inv.item_condition)}">${inv.item_condition}</span>
        </td>
        <td>${inv.storage_location || 'Gudang Dapur'}</td>
        <td>${inv.notes || '-'}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="deleteInventory(${inv.id})" title="Hapus stok" style="color: #dc2626;">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('loadInventory error:', err);
  }
}

function openAddInventoryModal() {
  document.getElementById('modal-add-inventory').classList.add('active');
  document.getElementById('inv-date').value = AppState.customDate;
}

async function handleSaveInventory(e) {
  e.preventDefault();
  const date = document.getElementById('inv-date').value;
  const item_name = document.getElementById('inv-name').value.trim();
  const category = document.getElementById('inv-category').value;
  const remaining_qty = parseFloat(document.getElementById('inv-qty').value) || 0;
  const unit = document.getElementById('inv-unit').value;
  const item_condition = document.getElementById('inv-condition').value;
  const storage_location = document.getElementById('inv-location').value.trim();
  const notes = document.getElementById('inv-notes').value.trim();

  if (!item_name || remaining_qty < 0) {
    showToast('Mohon isi nama bahan dan kuantitas sisa dengan benar', 'error');
    return;
  }

  try {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, item_name, category, remaining_qty, unit, item_condition, storage_location, notes
      })
    });
    if (!res.ok) throw new Error('Gagal menyimpan sisa bahan');
    
    showToast('Catatan stok sisa dapur berhasil disimpan!');
    closeAllModals();
    document.getElementById('form-add-inventory').reset();
    loadInventory();
    loadDashboard();
  } catch (err) {
    showToast('Gagal mencatat sisa bahan: ' + err.message, 'error');
  }
}

async function deleteInventory(id) {
  if (!confirm('Hapus item sisa bahan ini?')) return;
  try {
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    showToast('Stok sisa dihapus');
    loadInventory();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menghapus stok: ' + err.message, 'error');
  }
}

// ==========================================
// 4. BAHAN DIBUANG (FOOD WASTE) CONTROLLER
// ==========================================
async function loadWaste() {
  try {
    const search = document.getElementById('search-waste') ? document.getElementById('search-waste').value : '';
    const reason = document.getElementById('filter-reason-waste') ? document.getElementById('filter-reason-waste').value : 'ALL';
    
    let url = `/api/waste?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (reason && reason !== 'ALL') url += `&reason=${encodeURIComponent(reason)}`;

    const res = await fetch(url);
    const list = await res.json();
    AppState.waste = list;

    const tbody = document.getElementById('waste-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #16a34a;">Alhamdulillah belum ada bahan pangan yang terbuang</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((w, idx) => `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td><strong>${w.date}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${w.item_name}</div>
          <span class="badge ${getCategoryBadgeClass(w.category)}">${w.category}</span>
        </td>
        <td class="text-right font-mono" style="font-weight: 700; color: #dc2626;">
          ${w.waste_qty} ${w.unit}
        </td>
        <td class="text-right font-mono" style="font-weight: 800; color: #b91c1c;">
          ${formatRupiah(w.estimated_loss)}
        </td>
        <td>
          <span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 600;">${w.reason}</span>
        </td>
        <td>${w.notes || '-'}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="deleteWaste(${w.id})" title="Hapus catatan" style="color: #dc2626;">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('loadWaste error:', err);
  }
}

function openAddWasteModal() {
  document.getElementById('modal-add-waste').classList.add('active');
  document.getElementById('w-date').value = AppState.customDate;
}

async function handleSaveWaste(e) {
  e.preventDefault();
  const date = document.getElementById('w-date').value;
  const item_name = document.getElementById('w-name').value.trim();
  const category = document.getElementById('w-category').value;
  const waste_qty = parseFloat(document.getElementById('w-qty').value) || 0;
  const unit = document.getElementById('w-unit').value;
  const estimated_loss = parseFloat(document.getElementById('w-loss').value) || 0;
  const reason = document.getElementById('w-reason').value;
  const notes = document.getElementById('w-notes').value.trim();

  if (!item_name || waste_qty <= 0) {
    showToast('Mohon isi nama bahan dan kuantitas yang dibuang', 'error');
    return;
  }

  try {
    const res = await fetch('/api/waste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, item_name, category, waste_qty, unit, estimated_loss, reason, notes
      })
    });
    if (!res.ok) throw new Error('Gagal mencatat bahan dibuang');
    
    showToast('Catatan bahan dibuang berhasil disimpan!');
    closeAllModals();
    document.getElementById('form-add-waste').reset();
    loadWaste();
    loadDashboard();
  } catch (err) {
    showToast('Gagal mencatat: ' + err.message, 'error');
  }
}

async function deleteWaste(id) {
  if (!confirm('Hapus catatan bahan terbuang ini?')) return;
  try {
    await fetch(`/api/waste/${id}`, { method: 'DELETE' });
    showToast('Catatan dihapus');
    loadWaste();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ==========================================
// 5. KEUANGAN & LABA RUGI CONTROLLER
// ==========================================
async function loadFinances() {
  try {
    const search = document.getElementById('search-finance') ? document.getElementById('search-finance').value : '';
    const type = document.getElementById('filter-type-finance') ? document.getElementById('filter-type-finance').value : 'ALL';
    
    let url = `/api/finances?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (type && type !== 'ALL') url += `&flow_type=${encodeURIComponent(type)}`;

    const res = await fetch(url);
    const list = await res.json();
    AppState.finances = list;

    // Hitung otomatis total uang masuk, uang keluar, dan laba rugi bersih (Surplus/Defisit)
    const totalIncome = list.filter(f => f.type === 'INCOME').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const totalExpense = list.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const isProfit = netProfit >= 0;

    // Update Summary Bar Keuangan
    const sumIncEl = document.getElementById('fin-sum-income');
    const sumExpEl = document.getElementById('fin-sum-expense');
    const sumProfEl = document.getElementById('fin-sum-profit');
    const sumBalEl = document.getElementById('fin-sum-balance');

    if (sumIncEl) sumIncEl.textContent = `+ ${formatRupiah(totalIncome)}`;
    if (sumExpEl) sumExpEl.textContent = `- ${formatRupiah(totalExpense)}`;
    if (sumProfEl) {
      sumProfEl.textContent = (isProfit ? '+ ' : '- ') + formatRupiah(Math.abs(netProfit));
      sumProfEl.style.color = isProfit ? '#15803d' : '#b91c1c';
    }
    if (sumBalEl && AppState.stats) {
      sumBalEl.textContent = formatRupiah(AppState.stats.cash_flow.current_balance);
    }

    // Update Table Foot Keuangan
    const footIncEl = document.getElementById('fin-foot-income');
    const footExpEl = document.getElementById('fin-foot-expense');
    const footProfEl = document.getElementById('fin-foot-profit');

    if (footIncEl) footIncEl.textContent = `+ ${formatRupiah(totalIncome)}`;
    if (footExpEl) footExpEl.textContent = `- ${formatRupiah(totalExpense)}`;
    if (footProfEl) {
      footProfEl.textContent = (isProfit ? 'SURPLUS (+): ' : 'DEFISIT (-): ') + formatRupiah(Math.abs(netProfit));
      footProfEl.style.color = isProfit ? '#15803d' : '#b91c1c';
    }

    const tbody = document.getElementById('finance-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #94a3b8;">Belum ada catatan keuangan</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((f, idx) => {
      const isIncome = f.type === 'INCOME';
      return `
        <tr>
          <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
          <td><strong>${f.date}</strong></td>
          <td>
            <span class="badge" style="background: ${isIncome ? '#dcfce7' : '#fee2e2'}; color: ${isIncome ? '#15803d' : '#b91c1c'}; font-weight: 700;">
              ${isIncome ? '⬆️ UANG MASUK' : '⬇️ UANG KELUAR'}
            </span>
          </td>
          <td><strong>${f.category}</strong></td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${f.description}</div>
            ${f.ref_number ? `<small class="font-mono" style="color: #64748b;">Ref: ${f.ref_number}</small>` : ''}
          </td>
          <td>${f.source_or_recipient || '-'}</td>
          <td class="text-right font-mono" style="font-weight: 800; color: ${isIncome ? '#16a34a' : '#dc2626'}; font-size: 0.95rem;">
            ${isIncome ? '+' : '-'} ${formatRupiah(f.amount)}
          </td>
          <td class="text-center">
            <button class="btn btn-outline btn-sm" onclick="deleteFinance(${f.id})" title="Hapus transaksi" style="color: #dc2626;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('loadFinances error:', err);
  }
}

function openAddFinanceModal(defaultType = 'INCOME') {
  document.getElementById('modal-add-finance').classList.add('active');
  document.getElementById('f-date').value = AppState.customDate;
  document.getElementById('f-type').value = defaultType;
  updateFinanceCategoryOptions();
}

function updateFinanceCategoryOptions() {
  const type = document.getElementById('f-type').value;
  const catSelect = document.getElementById('f-category');
  if (!catSelect) return;

  if (type === 'INCOME') {
    catSelect.innerHTML = `
      <option value="Dana Anggaran MBG">Dana Anggaran MBG (APBN / Badan Gizi)</option>
      <option value="Dropping Kas Daerah">Dropping Kas APBD / Pemda</option>
      <option value="Dana Talangan / Sponsor">Dana Talangan / Sponsor Kemitraan</option>
      <option value="Penerimaan Lainnya">Penerimaan Kas Lainnya</option>
    `;
  } else {
    catSelect.innerHTML = `
      <option value="Belanja Bahan Pangan">Belanja Bahan Pangan (Sayur, Daging, Beras, dll)</option>
      <option value="Operasional Dapur">Operasional Dapur (Gas LPG, Listrik, Air Sanitasi)</option>
      <option value="Kemasan & Distribusi">Kemasan & Ompreng Makanan / Transport Pengantar</option>
      <option value="Honor Tim Masak">Honor & Insentif Juru Masak</option>
      <option value="Perawatan Alat Dapur">Perawatan Alat & Kebersihan Dapur</option>
      <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
    `;
  }
}

async function handleSaveFinance(e) {
  e.preventDefault();
  const date = document.getElementById('f-date').value;
  const type = document.getElementById('f-type').value;
  const category = document.getElementById('f-category').value;
  const amount = parseFloat(document.getElementById('f-amount').value) || 0;
  const description = document.getElementById('f-desc').value.trim();
  const source_or_recipient = document.getElementById('f-party').value.trim();
  const ref_number = document.getElementById('f-ref').value.trim();

  if (!description || amount <= 0) {
    showToast('Mohon isi uraian dan nominal transaksi', 'error');
    return;
  }

  try {
    const res = await fetch('/api/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, type, category, amount, description, source_or_recipient, ref_number
      })
    });
    if (!res.ok) throw new Error('Gagal mencatat transaksi');
    
    showToast('Transaksi keuangan berhasil dicatat!');
    closeAllModals();
    document.getElementById('form-add-finance').reset();
    loadFinances();
    loadDashboard();
  } catch (err) {
    showToast('Gagal mencatat: ' + err.message, 'error');
  }
}

async function deleteFinance(id) {
  if (!confirm('Yakin ingin menghapus catatan transaksi ini?')) return;
  try {
    await fetch(`/api/finances/${id}`, { method: 'DELETE' });
    showToast('Catatan keuangan dihapus');
    loadFinances();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ==========================================
// 6. PENGATURAN DAPUR SPPG CONTROLLER
// ==========================================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    AppState.settings = data;

    // Tampilkan di Header Topbar
    const headerTitle = document.getElementById('header-sppg-title');
    const headerLoc = document.getElementById('header-sppg-loc');
    if (headerTitle) headerTitle.textContent = data.kitchen_name || 'SPPG MBG';
    if (headerLoc) headerLoc.textContent = data.service_area || '';

    // Isi Form Pengaturan
    const fields = [
      'kitchen_name', 'service_area', 'manager_name', 'treasurer_name',
      'head_cook', 'daily_target_portions', 'budget_per_portion', 'active_schools'
    ];
    fields.forEach(f => {
      const el = document.getElementById(`set-${f}`);
      if (el && data[f]) el.value = data[f];
    });

  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const payload = {
    kitchen_name: document.getElementById('set-kitchen_name').value.trim(),
    service_area: document.getElementById('set-service_area').value.trim(),
    manager_name: document.getElementById('set-manager_name').value.trim(),
    treasurer_name: document.getElementById('set-treasurer_name').value.trim(),
    head_cook: document.getElementById('set-head_cook').value.trim(),
    daily_target_portions: document.getElementById('set-daily_target_portions').value.trim(),
    budget_per_portion: document.getElementById('set-budget_per_portion').value.trim(),
    active_schools: document.getElementById('set-active_schools').value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menyimpan pengaturan');
    
    showToast('Pengaturan profil Dapur SPPG berhasil disimpan!');
    loadSettings();
    loadDashboard();
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message, 'error');
  }
}

async function handleResetDemoData() {
  if (!confirm('Perhatian: Aksi ini akan mereset data ke sampel awal MBG. Lanjutkan?')) return;
  try {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    if (!res.ok) throw new Error('Gagal mereset');
    showToast('Data berhasil direset ke data sampel MBG!');
    loadSettings();
    loadDashboard();
    loadPurchases();
    loadInventory();
    loadWaste();
    loadFinances();
  } catch (err) {
    showToast('Gagal reset: ' + err.message, 'error');
  }
}

// Helpers
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('active');
  });
}

function getCategoryBadgeClass(cat) {
  switch (cat) {
    case 'Sayuran': return 'badge-cat-sayur';
    case 'Protein Hewani':
    case 'Protein Nabati': return 'badge-cat-protein';
    case 'Karbohidrat': return 'badge-cat-karbo';
    case 'Buah-buahan': return 'badge-cat-buah';
    case 'Susu & Pelengkap': return 'badge-cat-susu';
    default: return 'badge-cat-bumbu';
  }
}

function getConditionBadgeClass(cond) {
  if (cond.includes('Baik') || cond.includes('Segar')) return 'badge-cond-good';
  if (cond.includes('Segera')) return 'badge-cond-urgent';
  return 'badge-cond-monitor';
}
