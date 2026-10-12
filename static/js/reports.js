/**
 * Report Generation, Printing (A4 & Thermal 80mm), and Excel/CSV Export
 * Satuan Pelayanan Pemenuhan Gizi (SPPG) Dapur MBG
 */

const MBGReports = {
  currentRecapData: null,

  async loadRecap(period = 'today', customDate = null) {
    try {
      let url = `/api/reports/recap?period=${period}`;
      if (customDate) url += `&custom_date=${customDate}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data laporan');
      const data = await res.json();
      this.currentRecapData = data;
      this.renderA4Preview(data);
      this.renderThermalPreview(data);
      return data;
    } catch (err) {
      console.error('Error loadRecap:', err);
      showToast('Gagal memuat data laporan: ' + err.message, 'error');
    }
  },

  formatIDR(val) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val || 0);
  },

  renderA4Preview(data) {
    const container = document.getElementById('report-a4-content');
    if (!container) return;

    const s = data.summary;
    const settings = data.settings || {};
    const isProfit = s.period_profit_loss >= 0;
    const purchases = data.purchases || [];
    const stockOut = data.stock_out || [];
    const inventory = data.inventory || [];
    const waste = data.waste || [];
    const finances = data.finances || [];
    const mut = (data.mutations && data.mutations.items) ? data.mutations.items : [];
    const mutTotals = (data.mutations && data.mutations.totals) ? data.mutations.totals : {};

    let html = `
      <div class="official-kop">
        <div class="kop-logo-text">Program Makan Bergizi Gratis (MBG) RI</div>
        <h1 class="kop-main-title">LAPORAN LOGISTIK PANGAN & PERTANGGUNGJAWABAN KEUANGAN</h1>
        <div class="kop-sppg-name">${settings.kitchen_name || 'Satuan Pelayanan Pemenuhan Gizi (SPPG)'}</div>
        <div class="kop-address">${settings.service_area || 'Wilayah Layanan SPPG'} &bull; Sasaran: ${settings.active_schools || 'Sekolah Penerima MBG'}</div>
      </div>

      <div class="report-meta-info">
        <div>
          <strong>Periode Laporan:</strong> ${data.period_label}<br>
          <strong>Tanggal Cetak:</strong> ${data.generated_at}
        </div>
        <div style="text-align: right;">
          <strong>Target Porsi:</strong> ${settings.daily_target_portions || 1200} Porsi/Hari<br>
          <strong>Pagu Anggaran:</strong> ${this.formatIDR(settings.budget_per_portion || 15000)} / Porsi
        </div>
      </div>

      <!-- Kotak Ringkasan Utama Keuangan & Laba Rugi -->
      <div class="report-summary-boxes">
        <div class="report-box">
          <div class="title">Total Uang Masuk</div>
          <div class="val" style="color: #16a34a;">${this.formatIDR(s.total_income)}</div>
        </div>
        <div class="report-box">
          <div class="title">Total Pengeluaran</div>
          <div class="val" style="color: #dc2626;">${this.formatIDR(s.total_expense)}</div>
        </div>
        <div class="report-box" style="border: 2px solid ${isProfit ? '#16a34a' : '#dc2626'}; background: ${isProfit ? '#f0fdf4' : '#fef2f2'};">
          <div class="title">${isProfit ? 'Surplus Anggaran (Untung Efisiensi)' : 'Defisit Anggaran (Rugi / Overbudget)'}</div>
          <div class="val" style="color: ${isProfit ? '#15803d' : '#b91c1c'};">${this.formatIDR(Math.abs(s.period_profit_loss))}</div>
        </div>
        <div class="report-box">
          <div class="title">Sisa Saldo Kas Riil</div>
          <div class="val" style="color: #2563eb;">${this.formatIDR(s.cumulative_balance)}</div>
        </div>
      </div>

      <!-- Bagian 1: Pembelian Bahan Pangan (Stok Masuk) -->
      <div class="report-section-heading">
        <span>1. Rincian Pembelian Bahan Pangan / Stok Masuk (${purchases.length} Item)</span>
        <span style="margin-left: auto; font-size: 0.85rem; font-weight: normal; color: #475569;">
          Subtotal Belanja: <strong>${this.formatIDR(s.total_purchases_spent)}</strong>
        </span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Tanggal</th>
            <th>Nama Bahan Pangan</th>
            <th>Kategori</th>
            <th class="text-right">Jumlah</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-right">Total Biaya</th>
            <th>Pemasok / Toko</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (purchases.length === 0) {
      html += `<tr><td colspan="8" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada catatan pembelian pada periode ini</td></tr>`;
    } else {
      purchases.forEach((p, idx) => {
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${p.date}</td>
            <td><strong>${p.item_name}</strong></td>
            <td><span class="badge">${p.category}</span></td>
            <td class="text-right font-mono">${p.quantity} ${p.unit}</td>
            <td class="text-right font-mono">${this.formatIDR(p.unit_price)}</td>
            <td class="text-right font-mono" style="font-weight: 700;">${this.formatIDR(p.total_price)}</td>
            <td>${p.supplier || '-'}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800;">
            <td colspan="4" class="text-right">TOTAL PEMBELIAN BAHAN PANGAN:</td>
            <td class="text-right font-mono">${s.total_purchases_qty || purchases.reduce((a, b) => a + (parseFloat(b.quantity) || 0), 0)} unit/kg</td>
            <td></td>
            <td class="text-right font-mono" style="color: #059669;">${this.formatIDR(s.total_purchases_spent)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- Bagian 2: Pengeluaran Bahan Pangan (Barang Keluar) -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>2. Rincian Pengeluaran Bahan Pangan / Barang Keluar Dapur (${stockOut.length} Item)</span>
        <span style="margin-left: auto; font-size: 0.85rem; font-weight: normal; color: #0284c7;">
          Total Nilai Pemakaian: <strong>${this.formatIDR(s.total_stock_out_spent)}</strong>
        </span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Tanggal</th>
            <th>Nama Bahan Pangan</th>
            <th>Kategori</th>
            <th class="text-right">Jumlah Keluar</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-right">Total Nilai Pemakaian</th>
            <th>Keperluan / Menu Masakan</th>
            <th>Petugas / Chef</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (stockOut.length === 0) {
      html += `<tr><td colspan="9" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada catatan pengeluaran barang pada periode ini</td></tr>`;
    } else {
      stockOut.forEach((so, idx) => {
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${so.date}</td>
            <td><strong>${so.item_name}</strong></td>
            <td><span class="badge">${so.category}</span></td>
            <td class="text-right font-mono">${so.quantity} ${so.unit}</td>
            <td class="text-right font-mono">${this.formatIDR(so.unit_price)}</td>
            <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">${this.formatIDR(so.total_price)}</td>
            <td>${so.purpose || 'Menu MBG'}</td>
            <td>${so.chef_or_staff || '-'}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800;">
            <td colspan="4" class="text-right">TOTAL PENGELUARAN BARANG:</td>
            <td class="text-right font-mono">${s.total_stock_out_qty || stockOut.reduce((a, b) => a + (parseFloat(b.quantity) || 0), 0)} unit/kg</td>
            <td></td>
            <td class="text-right font-mono" style="color: #0284c7;">${this.formatIDR(s.total_stock_out_spent)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>

      <!-- Bagian 3: Rekap Keluar Masuk Barang (Mutasi Logistik Dapur) -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>3. Laporan Mutasi Keluar Masuk Barang & Status Logistik</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Bahan Pangan</th>
            <th>Kategori</th>
            <th>Satuan</th>
            <th class="text-right">Masuk (Beli)</th>
            <th class="text-right">Nilai Beli</th>
            <th class="text-right">Keluar (Pakai)</th>
            <th class="text-right">Nilai Keluar</th>
            <th class="text-right">Rusak (Waste)</th>
            <th class="text-right">Sisa Stok</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (mut.length === 0) {
      html += `<tr><td colspan="11" class="text-center" style="padding: 16px; color: #94a3b8;">Belum ada data mutasi logistik barang</td></tr>`;
    } else {
      mut.forEach((m, idx) => {
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${m.item_name}</strong></td>
            <td>${m.category}</td>
            <td>${m.unit}</td>
            <td class="text-right font-mono" style="color: #16a34a;">${m.in_qty}</td>
            <td class="text-right font-mono">${this.formatIDR(m.in_value)}</td>
            <td class="text-right font-mono" style="color: #0284c7;">${m.out_qty}</td>
            <td class="text-right font-mono">${this.formatIDR(m.out_value)}</td>
            <td class="text-right font-mono" style="color: #dc2626;">${m.waste_qty}</td>
            <td class="text-right font-mono" style="font-weight: 800; color: #d97706;">${m.remaining_qty}</td>
            <td class="text-center">${m.status}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800;">
            <td colspan="4" class="text-right">GRAND TOTAL MUTASI:</td>
            <td class="text-right font-mono" style="color: #16a34a;">${(mutTotals.grand_in_qty || 0).toLocaleString('id-ID')}</td>
            <td class="text-right font-mono" style="color: #16a34a;">${this.formatIDR(mutTotals.grand_in_value || 0)}</td>
            <td class="text-right font-mono" style="color: #0284c7;">${(mutTotals.grand_out_qty || 0).toLocaleString('id-ID')}</td>
            <td class="text-right font-mono" style="color: #0284c7;">${this.formatIDR(mutTotals.grand_out_value || 0)}</td>
            <td class="text-right font-mono" style="color: #dc2626;">${(mutTotals.grand_waste_qty || 0).toLocaleString('id-ID')}</td>
            <td class="text-right font-mono" style="color: #d97706;">${(mutTotals.grand_remaining_qty || 0).toLocaleString('id-ID')}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- Bagian 4: Bahan Terbuang / Kerusakan (Food Waste) -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>4. Catatan Bahan Terbuang / Rusak (Food Waste Log)</span>
        <span style="margin-left: auto; font-size: 0.85rem; font-weight: normal; color: #dc2626;">
          Estimasi Kerugian: <strong>${this.formatIDR(s.total_waste_loss)}</strong>
        </span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Tanggal</th>
            <th>Nama Bahan</th>
            <th class="text-right">Kuantitas Dibuang</th>
            <th class="text-right">Nilai Kerugian</th>
            <th>Penyebab / Alasan Pembuangan</th>
            <th>Tindakan / Catatan</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (waste.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 16px; color: #16a34a;">Alhamdulillah tidak ada bahan pangan yang terbuang pada periode ini</td></tr>`;
    } else {
      waste.forEach((w, idx) => {
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${w.date}</td>
            <td><strong>${w.item_name}</strong></td>
            <td class="text-right font-mono">${w.waste_qty} ${w.unit}</td>
            <td class="text-right font-mono" style="color: #dc2626; font-weight: 700;">${this.formatIDR(w.estimated_loss)}</td>
            <td><span class="badge" style="background:#fee2e2; color:#b91c1c;">${w.reason}</span></td>
            <td>${w.notes || '-'}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
      </table>

      <!-- Bagian 5: Arus Kas Keuangan & Laba Rugi -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>5. Rincian Mutasi Arus Kas & Laba / Rugi (Uang Masuk & Keluar)</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Tanggal</th>
            <th>Jenis</th>
            <th>Kategori</th>
            <th>Uraian / Deskripsi</th>
            <th>Pihak Terkait</th>
            <th class="text-right">Nominal</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (finances.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada transaksi keuangan pada periode ini</td></tr>`;
    } else {
      finances.forEach((f, idx) => {
        const isInc = f.type === 'INCOME';
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${f.date}</td>
            <td><span class="badge" style="background: ${isInc ? '#dcfce7' : '#fee2e2'}; color: ${isInc ? '#15803d' : '#b91c1c'}; font-weight: 700;">${isInc ? 'MASUK' : 'KELUAR'}</span></td>
            <td>${f.category}</td>
            <td>${f.description}</td>
            <td>${f.source_or_recipient || '-'}</td>
            <td class="text-right font-mono" style="color: ${isInc ? '#16a34a' : '#dc2626'}; font-weight: 700;">
              ${isInc ? '+' : '-'} ${this.formatIDR(f.amount)}
            </td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
        <tfoot>
          <tr style="background: #f0fdf4; font-weight: 700;">
            <td colspan="6" class="text-right" style="color: #15803d;">TOTAL UANG MASUK (PEMASUKAN):</td>
            <td class="text-right font-mono" style="color: #16a34a; font-weight: 800;">+ ${this.formatIDR(s.total_income)}</td>
          </tr>
          <tr style="background: #fef2f2; font-weight: 700;">
            <td colspan="6" class="text-right" style="color: #b91c1c;">TOTAL UANG KELUAR (PENGELUARAN):</td>
            <td class="text-right font-mono" style="color: #dc2626; font-weight: 800;">- ${this.formatIDR(s.total_expense)}</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 800; border-top: 1px dashed var(--border-color);">
            <td colspan="6" class="text-right">${isProfit ? 'SURPLUS ANGGARAN (LABA EFISIENSI):' : 'DEFISIT ANGGARAN (OVERBUDGET/RUGI):'}</td>
            <td class="text-right font-mono" style="color: ${isProfit ? '#15803d' : '#b91c1c'}; font-size: 0.95rem;">
              ${isProfit ? '+' : '-'} ${this.formatIDR(Math.abs(s.period_profit_loss))}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Kolom Tanda Tangan Resmi -->
      <div class="signatures-section">
        <div class="signature-box">
          <div class="role">Petugas Logistik & Juru Masak</div>
          <div class="sign-space"></div>
          <div class="name">${settings.head_cook || 'Chef Agus Priyono'}</div>
          <div class="sub">Kepala Dapur SPPG MBG</div>
        </div>
        <div class="signature-box">
          <div class="role">Penanggung Jawab SPPG / Bendahara</div>
          <div class="sign-space"></div>
          <div class="name">${settings.manager_name || 'Budi Santoso, S.Gz'}</div>
          <div class="sub">Kepala SPPG MBG</div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  renderThermalPreview(data) {
    const container = document.getElementById('report-thermal-content');
    if (!container) return;

    const s = data.summary;
    const settings = data.settings || {};
    const isProfit = s.period_profit_loss >= 0;

    let text = `
      <div style="text-align: center; font-weight: bold; font-size: 0.9rem;">
        *** SPPG MBG MANDIRI ***<br>
        PROGRAM MAKAN BERGIZI GRATIS<br>
        <span style="font-size: 0.75rem; font-weight: normal;">${settings.service_area || 'Kecamatan MBG'}</span>
      </div>
      <div class="thermal-divider"></div>
      <div>
        Periode: ${data.period_label}<br>
        Dicetak: ${data.generated_at}<br>
        Petugas: ${settings.head_cook || 'Staf Dapur'}
      </div>
      <div class="thermal-divider"></div>
      <div style="font-weight: bold; margin-bottom: 4px;">RINGKASAN KEUANGAN:</div>
      <div style="display: flex; justify-content: space-between;">
        <span>Uang Masuk:</span>
        <span style="color: #16a34a; font-weight: bold;">${this.formatIDR(s.total_income)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Uang Keluar:</span>
        <span style="color: #dc2626; font-weight: bold;">${this.formatIDR(s.total_expense)}</span>
      </div>
      <div class="thermal-divider"></div>
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>${isProfit ? 'SURPLUS (+):' : 'DEFISIT (-):'}</span>
        <span>${this.formatIDR(Math.abs(s.period_profit_loss))}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #444;">
        <span>Sisa Kas Berjalan:</span>
        <span>${this.formatIDR(s.cumulative_balance)}</span>
      </div>
      <div class="thermal-divider"></div>
      <div style="font-weight: bold; margin-bottom: 4px;">LOGISTIK PANGAN:</div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span>Total Pembelian (Beli):</span>
        <span style="font-weight: bold;">${this.formatIDR(s.total_purchases_spent)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span>Total Pemakaian (Keluar):</span>
        <span style="font-weight: bold; color: #0284c7;">${this.formatIDR(s.total_stock_out_spent)}</span>
      </div>
      <div class="thermal-divider"></div>
      <div style="font-weight: bold; margin-bottom: 4px;">BARANG KELUAR TERBARU:</div>
    `;

    (data.stock_out || []).slice(0, 6).forEach(so => {
      text += `
        <div style="margin-bottom: 4px;">
          <div>${so.item_name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #333;">
            <span>${so.quantity} ${so.unit} &bull; ${so.purpose || 'Menu MBG'}</span>
            <span style="font-weight: bold;">${this.formatIDR(so.total_price)}</span>
          </div>
        </div>
      `;
    });

    text += `
      <div class="thermal-divider"></div>
      <div style="text-align: center; font-size: 0.7rem; margin-top: 10px;">
        Terima Kasih Atas Dedikasi<br>
        Menyehatkan Anak Bangsa!<br>
        ==============================
      </div>
    `;

    container.innerHTML = text;
  },

  // Cetak ke Printer / Simpan PDF
  printReport(mode = 'a4') {
    if (mode === 'thermal') {
      document.body.classList.add('print-thermal-mode');
    } else {
      document.body.classList.remove('print-thermal-mode');
    }

    setTimeout(() => {
      window.print();
    }, 150);
  },

  // Ekspor ke Spreadsheet Excel (XML SpreadsheetML Format yang 100% kompatibel Excel & Google Sheets)
  exportToExcel() {
    if (!this.currentRecapData) {
      showToast('Data laporan belum siap diekspor', 'error');
      return;
    }

    const d = this.currentRecapData;
    const settings = d.settings || {};
    const filename = `Laporan_MBG_${d.period}_${d.start_date}.xls`;
    const mut = (d.mutations && d.mutations.items) ? d.mutations.items : [];
    const mutTotals = (d.mutations && d.mutations.totals) ? d.mutations.totals : {};

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40">
      <Styles>
        <Style ss:ID="Default" ss:Name="Normal">
          <Alignment ss:Vertical="Center"/>
          <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
        </Style>
        <Style ss:ID="HeaderTitle">
          <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#065f46"/>
        </Style>
        <Style ss:ID="HeaderSub">
          <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#475569"/>
        </Style>
        <Style ss:ID="ColHeader">
          <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
          <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
          <Interior ss:Color="#059669" ss:Pattern="Solid"/>
        </Style>
        <Style ss:ID="CurrencyCell">
          <NumberFormat ss:Format="&quot;Rp&quot;#,##0"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          </Borders>
        </Style>
        <Style ss:ID="CellNormal">
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          </Borders>
        </Style>
        <Style ss:ID="CellBold">
          <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          </Borders>
        </Style>
        <Style ss:ID="TotalRow">
          <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#065f46"/>
          <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/>
            <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3"/>
          </Borders>
        </Style>
      </Styles>

      <!-- SHEET 1: REKAP KEUANGAN -->
      <Worksheet ss:Name="Rekap Keuangan MBG">
        <Table ss:DefaultColumnWidth="140">
          <Column ss:Width="200"/>
          <Column ss:Width="200"/>
          <Row>
            <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">LAPORAN KEUANGAN DAPUR SPPG MBG</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="HeaderSub"><Data ss:Type="String">Periode: ${d.period_label} | ${settings.kitchen_name || ''}</Data></Cell>
          </Row>
          <Row ss:Index="4">
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Indikator Keuangan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Jumlah Nominal (IDR)</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Uang Masuk (Pemasukan)</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_income}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Uang Keluar (Pengeluaran)</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_expense}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="TotalRow"><Data ss:Type="String">${d.summary.is_profit ? 'SURPLUS ANGGARAN (LABA UNTUNG)' : 'DEFISIT ANGGARAN (RUGI)'}</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.period_profit_loss}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellBold"><Data ss:Type="String">Saldo Kas Riil Berjalan</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.cumulative_balance}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Belanja Bahan Pangan</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_purchases_spent}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Pengeluaran Bahan (Barang Keluar)</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_stock_out_spent || 0}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Estimasi Kerugian Bahan Dibuang</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_waste_loss}</Data></Cell>
          </Row>
        </Table>
      </Worksheet>

      <!-- SHEET 2: PEMBELIAN BAHAN PANGAN -->
      <Worksheet ss:Name="Pembelian Bahan">
        <Table ss:DefaultColumnWidth="110">
          <Column ss:Width="40"/>
          <Column ss:Width="90"/>
          <Column ss:Width="180"/>
          <Column ss:Width="110"/>
          <Column ss:Width="80"/>
          <Column ss:Width="60"/>
          <Column ss:Width="100"/>
          <Column ss:Width="120"/>
          <Column ss:Width="140"/>
          <Row>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Tanggal</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nama Bahan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kategori</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kuantitas</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Satuan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Harga Satuan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Harga</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Pemasok / Sumber</Data></Cell>
          </Row>
    `;

    d.purchases.forEach((p, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${p.date}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${p.item_name}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${p.category}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${p.quantity}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${p.unit}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${p.unit_price}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${p.total_price}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${p.supplier || '-'}</Data></Cell>
        </Row>
      `;
    });

    xml += `
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${d.summary.total_purchases_qty || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_purchases_spent || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
        </Row>
      </Table>
    </Worksheet>

    <!-- SHEET 3: PENGELUARAN BAHAN (BARANG KELUAR) -->
    <Worksheet ss:Name="Barang Keluar">
      <Table ss:DefaultColumnWidth="110">
        <Column ss:Width="40"/>
        <Column ss:Width="90"/>
        <Column ss:Width="180"/>
        <Column ss:Width="110"/>
        <Column ss:Width="80"/>
        <Column ss:Width="60"/>
        <Column ss:Width="100"/>
        <Column ss:Width="120"/>
        <Column ss:Width="140"/>
        <Column ss:Width="110"/>
        <Row>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Tanggal</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nama Bahan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kategori</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kuantitas Keluar</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Satuan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Harga Satuan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Nilai</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Menu / Keperluan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Chef / Petugas</Data></Cell>
        </Row>
    `;

    (d.stock_out || []).forEach((so, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${so.date}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${so.item_name}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${so.category}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${so.quantity}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${so.unit}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${so.unit_price}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${so.total_price}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${so.purpose || '-'}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${so.chef_or_staff || '-'}</Data></Cell>
        </Row>
      `;
    });

    xml += `
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${d.summary.total_stock_out_qty || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_stock_out_spent || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
        </Row>
      </Table>
    </Worksheet>

    <!-- SHEET 4: MUTASI KELUAR MASUK BARANG -->
    <Worksheet ss:Name="Mutasi Logistik">
      <Table ss:DefaultColumnWidth="110">
        <Column ss:Width="40"/>
        <Column ss:Width="180"/>
        <Column ss:Width="100"/>
        <Column ss:Width="60"/>
        <Column ss:Width="90"/>
        <Column ss:Width="110"/>
        <Column ss:Width="90"/>
        <Column ss:Width="110"/>
        <Column ss:Width="80"/>
        <Column ss:Width="80"/>
        <Column ss:Width="90"/>
        <Row>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nama Bahan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kategori</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Satuan</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Stok Masuk</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nilai Beli</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Stok Keluar</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nilai Pemakaian</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Waste</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Sisa Stok</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Status</Data></Cell>
        </Row>
    `;

    mut.forEach((m, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${m.item_name}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${m.category}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${m.unit}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${m.in_qty}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${m.in_value}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${m.out_qty}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${m.out_value}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${m.waste_qty}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="Number">${m.remaining_qty}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${m.status}</Data></Cell>
        </Row>
      `;
    });

    xml += `
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${mutTotals.grand_in_qty || 0}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${mutTotals.grand_in_value || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${mutTotals.grand_out_qty || 0}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${mutTotals.grand_out_value || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${mutTotals.grand_waste_qty || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="Number">${mutTotals.grand_remaining_qty || 0}</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
        </Row>
      </Table>
    </Worksheet>

    <!-- SHEET 5: ARUS KAS KEUANGAN -->
    <Worksheet ss:Name="Mutasi Arus Kas">
      <Table ss:DefaultColumnWidth="120">
        <Column ss:Width="40"/>
        <Column ss:Width="90"/>
        <Column ss:Width="80"/>
        <Column ss:Width="130"/>
        <Column ss:Width="200"/>
        <Column ss:Width="140"/>
        <Column ss:Width="120"/>
        <Row>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Tanggal</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Jenis</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kategori</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Uraian Transaksi</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Pihak / Rekening</Data></Cell>
          <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nominal (IDR)</Data></Cell>
        </Row>
    `;

    d.finances.forEach((f, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${f.date}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${f.type === 'INCOME' ? 'MASUK' : 'KELUAR'}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${f.category}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${f.description}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${f.source_or_recipient || '-'}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${f.amount}</Data></Cell>
        </Row>
      `;
    });

    xml += `
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL MASUK</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_income}</Data></Cell>
        </Row>
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL KELUAR</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_expense}</Data></Cell>
        </Row>
        <Row>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String">LABA BERSIH (SURPLUS/DEFISIT)</Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="TotalRow"><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.period_profit_loss}</Data></Cell>
        </Row>
      </Table>
    </Worksheet>
    </Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast('File Excel (.xls) berhasil diunduh dengan ringkasan mutasi & keuangan lengkap!', 'success');
  },

  // Ekspor alternatif ke CSV
  exportToCSV() {
    if (!this.currentRecapData) return;
    const d = this.currentRecapData;
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'TANGGAL,JENIS MUTASI,KATEGORI,URAIAN / NAMA BAHAN,KUANTITAS,SATUAN,HARGA SATUAN,TOTAL NILAI (RP),KETERANGAN / SUMBER\n';

    d.purchases.forEach(p => {
      csv += `"${p.date}","PEMBELIAN (STOK MASUK)","${p.category}","${p.item_name}",${p.quantity},"${p.unit}",${p.unit_price},${p.total_price},"${p.supplier || ''}"\n`;
    });

    (d.stock_out || []).forEach(so => {
      csv += `"${so.date}","BARANG KELUAR (PEMAKAIAN)","${so.category}","${so.item_name}",${so.quantity},"${so.unit}",${so.unit_price},${so.total_price},"${so.purpose || ''}"\n`;
    });

    d.finances.forEach(f => {
      csv += `"${f.date}","ARUS KAS ${f.type}","${f.category}","${f.description}",1,"-",${f.amount},${f.amount},"${f.source_or_recipient || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Data_MBG_${d.period}_${d.start_date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('File CSV berhasil diunduh!', 'success');
  }
};
