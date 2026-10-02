/**
 * Standalone Offline Chart Engine for Dapur MBG
 * Zero-dependency, pure HTML5 Canvas & SVG rendering
 */

const MBGCharts = {
  // 1. Doughnut Chart for Food Categories
  renderDoughnut(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 300;
    const height = canvas.height = 240;

    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data belanja bahan', width / 2, height / 2);
      return;
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Total belanja Rp 0', width / 2, height / 2);
      return;
    }

    const colors = options.colors || [
      '#059669', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'
    ];

    const centerX = width * 0.4;
    const centerY = height / 2;
    const radius = Math.min(centerX - 20, centerY - 20);
    const innerRadius = radius * 0.58;

    let currentAngle = -0.5 * Math.PI;

    // Gambar segmen donat
    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const color = colors[index % colors.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      currentAngle += sliceAngle;
    });

    // Center text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px sans-serif';
    ctx.fillText('TOTAL', centerX, centerY - 8);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    
    // Singkatkan jika besar (e.g. 1.2jt)
    const shortTotal = total >= 1000000 
      ? (total / 1000000).toFixed(1) + ' Jt' 
      : total.toLocaleString('id-ID');
    ctx.fillText('Rp ' + shortTotal, centerX, centerY + 10);

    // Gambar Legend di samping kanan
    const legendX = width * 0.72;
    let legendY = 30;

    data.slice(0, 6).forEach((item, index) => {
      const color = colors[index % colors.length];
      const pct = Math.round((item.value / total) * 100);

      // Color box
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect 
        ? ctx.roundRect(legendX - 10, legendY - 5, 10, 10, 3) 
        : ctx.rect(legendX - 10, legendY - 5, 10, 10);
      ctx.fill();

      // Label & Pct
      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = '500 11px sans-serif';
      
      const label = item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label;
      ctx.fillText(`${label} (${pct}%)`, legendX + 6, legendY + 4);

      legendY += 26;
    });
  },

  // 2. Bar Chart for Financial Comparison (Pemasukan vs Pengeluaran & Sisa)
  renderFinanceBar(canvasId, income, expense, surplus) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 400;
    const height = canvas.height = 240;

    ctx.clearRect(0, 0, width, height);

    const items = [
      { label: 'Uang Masuk', value: income, color: '#16a34a', bg: '#dcfce7' },
      { label: 'Uang Keluar', value: expense, color: '#dc2626', bg: '#fee2e2' },
      { 
        label: surplus >= 0 ? 'Surplus (Untung)' : 'Defisit (Rugi)', 
        value: Math.abs(surplus), 
        color: surplus >= 0 ? '#d97706' : '#991b1b', 
        bg: surplus >= 0 ? '#fef3c7' : '#fee2e2' 
      }
    ];

    const maxVal = Math.max(...items.map(i => i.value), 1000000);
    const chartHeight = height - 60;
    const barWidth = Math.min(width / 4.5, 65);
    const gap = (width - (barWidth * items.length)) / (items.length + 1);

    // Garis dasar
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, chartHeight + 20);
    ctx.lineTo(width - 10, chartHeight + 20);
    ctx.stroke();

    items.forEach((item, index) => {
      const x = gap + index * (barWidth + gap);
      const barH = (item.value / maxVal) * (chartHeight - 40);
      const y = chartHeight + 20 - barH;

      // Background pill bar
      ctx.fillStyle = item.bg;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, chartHeight + 20 - (chartHeight - 20), barWidth, chartHeight - 20, 6);
      } else {
        ctx.rect(x, chartHeight + 20 - (chartHeight - 20), barWidth, chartHeight - 20);
      }
      ctx.fill();

      // Value bar
      ctx.fillStyle = item.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.fill();

      // Text Nilai
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = item.color;

      const formatted = item.value >= 1000000 
        ? (item.value / 1000000).toFixed(1) + ' Jt' 
        : (item.value / 1000).toFixed(0) + ' Rb';
      ctx.fillText(formatted, x + barWidth / 2, y - 6);

      // Text Label
      ctx.font = '600 11px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(item.label, x + barWidth / 2, chartHeight + 38);
    });
  }
};
