/**
 * Report Generation, Printing (A4 & Thermal 80mm), and Excel Export
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

      <!-- Kotak Ringkasan Utama -->
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

      <!-- Bagian 1: Pembelian Bahan Pangan -->
      <div class="report-section-heading">
        <span>1. Rincian Pembelian Bahan Pangan (${data.purchases.length} Item)</span>
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

    if (data.purchases.length === 0) {
      html += `<tr><td colspan="8" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada catatan pembelian pada periode ini</td></tr>`;
    } else {
      data.purchases.forEach((p, idx) => {
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
      </table>

      <!-- Bagian 2: Stok Sisa Bahan Pangan -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>2. Rekap Stok Sisa Bahan Pangan di Dapur (${data.inventory.length} Item)</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Bahan</th>
            <th>Kategori</th>
            <th class="text-right">Stok Tersisa</th>
            <th>Kondisi Bahan</th>
            <th>Lokasi Simpan</th>
            <th>Catatan Petugas</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (data.inventory.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada catatan sisa bahan saat ini</td></tr>`;
    } else {
      data.inventory.forEach((inv, idx) => {
        html += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${inv.item_name}</strong></td>
            <td>${inv.category}</td>
            <td class="text-right font-mono"><strong>${inv.remaining_qty} ${inv.unit}</strong></td>
            <td>${inv.item_condition}</td>
            <td>${inv.storage_location || 'Dapur'}</td>
            <td>${inv.notes || '-'}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
      </table>

      <!-- Bagian 3: Bahan Terbuang / Kerusakan (Food Waste) -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>3. Catatan Bahan Terbuang / Rusak (Food Waste Log)</span>
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

    if (data.waste.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 16px; color: #16a34a;">Alhamdulillah tidak ada bahan pangan yang terbuang pada periode ini</td></tr>`;
    } else {
      data.waste.forEach((w, idx) => {
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

      <!-- Bagian 4: Arus Kas Keuangan -->
      <div class="report-section-heading" style="margin-top: 24px;">
        <span>4. Rincian Mutasi Arus Kas (Uang Masuk & Keluar)</span>
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

    if (data.finances.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada transaksi keuangan pada periode ini</td></tr>`;
    } else {
      data.finances.forEach((f, idx) => {
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
        <span>${this.formatIDR(s.total_income)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Uang Keluar:</span>
        <span>${this.formatIDR(s.total_expense)}</span>
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
      <div style="font-weight: bold; margin-bottom: 4px;">BELANJA PANGAN TERBARU:</div>
    `;

    data.purchases.slice(0, 10).forEach(p => {
      text += `
        <div style="margin-bottom: 4px;">
          <div>${p.item_name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #333;">
            <span>${p.quantity} ${p.unit} @ ${this.formatIDR(p.unit_price)}</span>
            <span style="font-weight: bold;">${this.formatIDR(p.total_price)}</span>
          </div>
        </div>
      `;
    });

    if (data.purchases.length > 10) {
      text += `<div style="text-align: center; font-size: 0.7rem;">...dan ${data.purchases.length - 10} item lainnya</div>`;
    }

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

    // Buat format XML Spreadsheet 2003 yang didukung penuh oleh Microsoft Excel tanpa library luar
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
      </Styles>

      <!-- SHEET 1: REKAP KEUANGAN -->
      <Worksheet ss:Name="Rekap Keuangan MBG">
        <Table ss:DefaultColumnWidth="120">
          <Column ss:Width="160"/>
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
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Uang Masuk (Periode Ini)</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_income}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Total Pengeluaran (Periode Ini)</Data></Cell>
            <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${d.summary.total_expense}</Data></Cell>
          </Row>
          <Row>
            <Cell ss:StyleID="CellBold"><Data ss:Type="String">${d.summary.is_profit ? 'SURPLUS ANGGARAN (UNTUNG)' : 'DEFISIT ANGGARAN (RUGI)'}</Data></Cell>
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
        </Table>
      </Worksheet>

      <!-- SHEET 3: SISA STOK -->
      <Worksheet ss:Name="Sisa Stok Pangan">
        <Table ss:DefaultColumnWidth="120">
          <Column ss:Width="40"/>
          <Column ss:Width="180"/>
          <Column ss:Width="110"/>
          <Column ss:Width="90"/>
          <Column ss:Width="60"/>
          <Column ss:Width="110"/>
          <Column ss:Width="130"/>
          <Row>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nama Bahan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kategori</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Sisa Stok</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Satuan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Kondisi</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Lokasi Gudang</Data></Cell>
          </Row>
    `;

    d.inventory.forEach((inv, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${inv.item_name}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${inv.category}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="Number">${inv.remaining_qty}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${inv.unit}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${inv.item_condition}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${inv.storage_location}</Data></Cell>
        </Row>
      `;
    });

    xml += `
        </Table>
      </Worksheet>

      <!-- SHEET 4: BAHAN DIBUANG (FOOD WASTE) -->
      <Worksheet ss:Name="Bahan Dibuang (Waste)">
        <Table ss:DefaultColumnWidth="120">
          <Column ss:Width="40"/>
          <Column ss:Width="90"/>
          <Column ss:Width="180"/>
          <Column ss:Width="90"/>
          <Column ss:Width="60"/>
          <Column ss:Width="120"/>
          <Column ss:Width="160"/>
          <Row>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">No</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Tanggal</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Nama Bahan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Jumlah Dibuang</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Satuan</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Taksiran Kerugian</Data></Cell>
            <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Penyebab / Alasan</Data></Cell>
          </Row>
    `;

    d.waste.forEach((w, idx) => {
      xml += `
        <Row>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${w.date}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${w.item_name}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="Number">${w.waste_qty}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${w.unit}</Data></Cell>
          <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${w.estimated_loss}</Data></Cell>
          <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${w.reason}</Data></Cell>
        </Row>
      `;
    });

    xml += `
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

    showToast('File Excel (.xls) berhasil diunduh!', 'success');
  },

  // Ekspor alternatif ke CSV
  exportToCSV() {
    if (!this.currentRecapData) return;
    const d = this.currentRecapData;
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'TANGGAL,JENIS TRANSAKSI,KATEGORI,URAIAN / BAHAN,JUMLAH,SATUAN,HARGA SATUAN,TOTAL NOMINAL,KETERANGAN\n';

    d.purchases.forEach(p => {
      csv += `"${p.date}","PEMBELIAN BAHAN","${p.category}","${p.item_name}",${p.quantity},"${p.unit}",${p.unit_price},${p.total_price},"${p.supplier || ''}"\n`;
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
