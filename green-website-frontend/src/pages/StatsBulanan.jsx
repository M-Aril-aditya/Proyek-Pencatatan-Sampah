import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#27ae60', '#f39c12', '#c0392b']; 

// Helper untuk Opsi Dropdown
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= 2023; i--) { 
    years.push(i);
  }
  return years;
};
const monthOptions = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

function StatsBulanan() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const jsDate = new Date();
  const [selectedYear, setSelectedYear] = useState(jsDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(jsDate.getMonth() + 1); 

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/'); return; }

      const params = { 
        range: 'monthly',
        year: selectedYear,
        month: selectedMonth
      }; 
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        const statsRequest = axios.get('http://localhost:5000/api/stats', { params, headers });
        const recordsRequest = axios.get('http://localhost:5000/api/records', { params, headers });

        const [statsResponse, recordsResponse] = await Promise.all([
          statsRequest,
          recordsRequest
        ]);

        setPieData(statsResponse.data);
        setTableData(recordsResponse.data);
        const newTotal = statsResponse.data.reduce((sum, entry) => sum + entry.value, 0);
        setTotalWeight(newTotal);
        
      } catch (error) {
        console.error('Error fetching monthly data:', error);
        setErrorMessage('Gagal mengambil data statistik bulanan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedYear, selectedMonth]); 

  // Helper Load Script PDF
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.body.appendChild(script);
    });
  };

  // --- LOGIKA EKSPOR PDF (DENGAN TOTAL HARIAN & BULANAN) ---
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const reportData = {};
      
      for (let d = 1; d <= daysInMonth; d++) {
        reportData[d] = {
            'Area Kantor': { organik: 0, anorganik: 0, residu: 0 },
            'Area Parkir': { organik: 0, anorganik: 0, residu: 0 },
            'Area Makan': { organik: 0, anorganik: 0, residu: 0 },
            'Area Ruang Tunggu': { organik: 0, anorganik: 0, residu: 0 },
        };
      }

      tableData.forEach(row => {
        const dateObj = new Date(row.recorded_at);
        const day = dateObj.getDate();
        let area = row.area_label ? row.area_label.trim() : '';
        const status = row.status ? row.status.trim() : '';
        const weight = parseFloat(row.weight_kg) || 0;

        let targetAreaKey = null;
        if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
        else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
        else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
        else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

        if (targetAreaKey && reportData[day]) {
            if (status === 'Organik Terpilah') reportData[day][targetAreaKey].organik += weight;
            else if (status === 'Anorganik Terpilah') reportData[day][targetAreaKey].anorganik += weight;
            else if (status === 'Tidak Terkelola') reportData[day][targetAreaKey].residu += weight;
        }
      });

      const body = [];

      // Header 1
      const headerRow1 = [
        { text: 'No', rowSpan: 3, style: 'tableHeader' },
        { text: 'Tgl', rowSpan: 3, style: 'tableHeader' },
        { text: 'Area Kantor', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Parkir', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Makan', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Ruang Tunggu', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        // Tambahan Kolom Total Harian
        { text: 'TOTAL HARIAN', rowSpan: 3, style: 'tableHeader' } 
      ];
      // Header 2
      const headerRow2 = [
        {}, {},
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        {}
      ];
      
      // Baris Kosong untuk Spacing Header (menggantikan rowSpan visual di PDFMake)
      const headerRow3 = [{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {}];

      body.push(headerRow1);
      body.push(headerRow2);
      body.push(headerRow3);

      // --- AKUMULATOR UNTUK TOTAL BULANAN (VERTIKAL) ---
      let colTotals = {
          k_org: 0, k_ano: 0, k_res: 0, k_tot: 0,
          p_org: 0, p_ano: 0, p_res: 0, p_tot: 0,
          m_org: 0, m_ano: 0, m_res: 0, m_tot: 0,
          t_org: 0, t_ano: 0, t_res: 0, t_tot: 0,
          grand_total: 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
        const r = reportData[d];
        
        // Hitung Horizontal (Harian)
        const k_tot = r['Area Kantor'].organik + r['Area Kantor'].anorganik + r['Area Kantor'].residu;
        const p_tot = r['Area Parkir'].organik + r['Area Parkir'].anorganik + r['Area Parkir'].residu;
        const m_tot = r['Area Makan'].organik + r['Area Makan'].anorganik + r['Area Makan'].residu;
        const t_tot = r['Area Ruang Tunggu'].organik + r['Area Ruang Tunggu'].anorganik + r['Area Ruang Tunggu'].residu;
        
        const dailyTotal = k_tot + p_tot + m_tot + t_tot;

        // Tambahkan ke Akumulator Vertikal
        colTotals.k_org += r['Area Kantor'].organik; colTotals.k_ano += r['Area Kantor'].anorganik; colTotals.k_res += r['Area Kantor'].residu; colTotals.k_tot += k_tot;
        colTotals.p_org += r['Area Parkir'].organik; colTotals.p_ano += r['Area Parkir'].anorganik; colTotals.p_res += r['Area Parkir'].residu; colTotals.p_tot += p_tot;
        colTotals.m_org += r['Area Makan'].organik; colTotals.m_ano += r['Area Makan'].anorganik; colTotals.m_res += r['Area Makan'].residu; colTotals.m_tot += m_tot;
        colTotals.t_org += r['Area Ruang Tunggu'].organik; colTotals.t_ano += r['Area Ruang Tunggu'].anorganik; colTotals.t_res += r['Area Ruang Tunggu'].residu; colTotals.t_tot += t_tot;
        colTotals.grand_total += dailyTotal;

        const row = [
            { text: d.toString(), style: 'tableCell' },
            { text: d.toString(), style: 'tableCell' },
            // Kantor
            { text: r['Area Kantor'].organik || '-', style: 'tableCell' },
            { text: r['Area Kantor'].anorganik || '-', style: 'tableCell' },
            { text: r['Area Kantor'].residu || '-', style: 'tableCell' },
            { text: k_tot || '-', style: 'tableBold' },
            // Parkir
            { text: r['Area Parkir'].organik || '-', style: 'tableCell' },
            { text: r['Area Parkir'].anorganik || '-', style: 'tableCell' },
            { text: r['Area Parkir'].residu || '-', style: 'tableCell' },
            { text: p_tot || '-', style: 'tableBold' },
            // Makan
            { text: r['Area Makan'].organik || '-', style: 'tableCell' },
            { text: r['Area Makan'].anorganik || '-', style: 'tableCell' },
            { text: r['Area Makan'].residu || '-', style: 'tableCell' },
            { text: m_tot || '-', style: 'tableBold' },
            // Tunggu
            { text: r['Area Ruang Tunggu'].organik || '-', style: 'tableCell' },
            { text: r['Area Ruang Tunggu'].anorganik || '-', style: 'tableCell' },
            { text: r['Area Ruang Tunggu'].residu || '-', style: 'tableCell' },
            { text: t_tot || '-', style: 'tableBold' },
            // TOTAL HARIAN
            { text: dailyTotal.toFixed(2), style: 'tableBold' }
        ];
        body.push(row);
      }

      // --- BARIS TOTAL BULANAN (BAWAH) ---
      const totalRow = [
          { text: 'TOTAL BULANAN', colSpan: 2, style: 'tableHeader', alignment: 'center' }, {},
          
          // Kantor
          { text: colTotals.k_org.toFixed(2), style: 'tableBold' },
          { text: colTotals.k_ano.toFixed(2), style: 'tableBold' },
          { text: colTotals.k_res.toFixed(2), style: 'tableBold' },
          { text: colTotals.k_tot.toFixed(2), style: 'tableBold' },
          
          // Parkir
          { text: colTotals.p_org.toFixed(2), style: 'tableBold' },
          { text: colTotals.p_ano.toFixed(2), style: 'tableBold' },
          { text: colTotals.p_res.toFixed(2), style: 'tableBold' },
          { text: colTotals.p_tot.toFixed(2), style: 'tableBold' },

          // Makan
          { text: colTotals.m_org.toFixed(2), style: 'tableBold' },
          { text: colTotals.m_ano.toFixed(2), style: 'tableBold' },
          { text: colTotals.m_res.toFixed(2), style: 'tableBold' },
          { text: colTotals.m_tot.toFixed(2), style: 'tableBold' },

          // Tunggu
          { text: colTotals.t_org.toFixed(2), style: 'tableBold' },
          { text: colTotals.t_ano.toFixed(2), style: 'tableBold' },
          { text: colTotals.t_res.toFixed(2), style: 'tableBold' },
          { text: colTotals.t_tot.toFixed(2), style: 'tableBold' },

          // GRAND TOTAL
          { text: colTotals.grand_total.toFixed(2), style: 'tableHeader' }
      ];
      body.push(totalRow);

      const totalTonRow = [
          { text: 'Total/jenis (ton/bulan)', colSpan: 2, style: 'tableHeader', alignment: 'left', fillColor: '#ffccbc' }, {},
          
          // Bagi setiap nilai dengan 1000
          { text: (colTotals.k_org / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.k_ano / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.k_res / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.k_tot / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          
          { text: (colTotals.p_org / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.p_ano / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.p_res / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.p_tot / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },

          { text: (colTotals.m_org / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.m_ano / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.m_res / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.m_tot / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },

          { text: (colTotals.t_org / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.t_ano / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.t_res / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (colTotals.t_tot / 1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },

          { text: (colTotals.grand_total / 1000).toFixed(3), style: 'tableHeader', fillColor: '#ffccbc' }
      ];
      body.push(totalTonRow);

      // --- 3. BARIS RATA-RATA HARIAN (BARU) ---
      const avgRow = [
          { text: 'Rata-rata perhari (kg/hari)', colSpan: 2, style: 'tableHeader', alignment: 'left', fillColor: '#ffe0b2' }, {},
          
          // Bagi setiap nilai dengan daysInMonth
          { text: (colTotals.k_org / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.k_ano / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.k_res / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.k_tot / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          
          { text: (colTotals.p_org / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.p_ano / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.p_res / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.p_tot / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },

          { text: (colTotals.m_org / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.m_ano / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.m_res / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.m_tot / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },

          { text: (colTotals.t_org / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.t_ano / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.t_res / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (colTotals.t_tot / daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },

          { text: (colTotals.grand_total / daysInMonth).toFixed(2), style: 'tableHeader', fillColor: '#ffe0b2' }
      ];
      body.push(avgRow);

      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content: [
          { text: `REKAMAN TIMBULAN SAMPAH - ${selectedMonth}/${selectedYear}`, style: 'header' },
          { text: 'PT. Dexa Medica Palembang', style: 'subheader' },
          {
            style: 'tableExample',
            table: {
              headerRows: 3, // 3 Baris Header agar berulang di halaman baru
              widths: [15, 15,  22,22,22,25,  22,22,22,25,  22,22,22,25,  22,22,22,25, 35],
              body: body
            },
            layout: {
                fillColor: function (rowIndex, node, columnIndex) {
                    return (rowIndex < 3 || rowIndex === body.length - 1) ? '#f1c40f' : null; // Kuning untuk Header & Footer
                }
            }
          }
        ],
        styles: {
          header: { fontSize: 14, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
          subheader: { fontSize: 10, margin: [0, 0, 0, 10], alignment: 'center' },
          tableHeader: { bold: true, fontSize: 6, color: 'black', alignment: 'center' }, // Font diperkecil
          tableCell: { fontSize: 6, alignment: 'center' },
          tableBold: { fontSize: 6, bold: true, alignment: 'center' }
        }
      };

      window.pdfMake.createPdf(docDefinition).download(`Laporan_Bulanan_${selectedMonth}-${selectedYear}.pdf`);

    } catch (error) {
      console.error('Error export PDF:', error);
      alert('Gagal membuat PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');

    try {
      const response = await axios.get('http://localhost:5000/api/export/monthly', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear },
        responseType: 'blob', 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `laporan_bulanan_${selectedMonth}-${selectedYear}.xlsx`; 
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (filenameMatch && filenameMatch.length === 2) filename = filenameMatch[1];
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting XLSX:', error);
      setErrorMessage('Gagal mengekspor Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="content-section">
      <h2>Statistik Bulanan</h2>

      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Tahun:</label>
          <select style={styles.filterSelect} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {generateYearOptions().map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Bulan:</label>
          <select style={styles.filterSelect} value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {monthOptions.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
        </div>
      </div>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      : totalWeight === 0 ? ( <p>Belum ada data untuk periode ini.</p> )
      : (
        <div style={{ width: '100%', height: 300, marginBottom: '2rem' }}>
          <ResponsiveContainer>
             <PieChart>
               <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                 {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
               </Pie>
               <Tooltip formatter={(value) => `${value.toFixed(2)} Kg`} />
               <Legend />
             </PieChart>
           </ResponsiveContainer>
         </div>
       )}

      {!isLoading && (
        <div style={styles.previewContainer}>
          <div style={styles.tableHeaderContainer}>
            <h3 style={styles.previewTitle}>Data Mentah (Bulan Ini)</h3>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleExportXLSX} style={styles.exportButtonXLSX} disabled={isExporting}>
                {isExporting ? '...' : 'Ekspor Excel'}
                </button>
                <button onClick={handleExportPDF} style={styles.exportButtonPDF} disabled={isExporting}>
                {isExporting ? '...' : 'Ekspor PDF'}
                </button>
            </div>

          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Area</th>
                  <th style={styles.th}>Nama Item</th>
                  <th style={styles.th}>Pengelola</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Bobot (Kg)</th>
                  <th style={styles.th}>Petugas</th>
                  <th style={styles.th}>Waktu Catat</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? (
                  tableData.map((row, index) => (
                    <tr key={index}>
                      <td style={styles.td}>{row.area_label}</td>
                      <td style={styles.td}>{row.item_label}</td>
                      <td style={styles.td}>{row.pengelola}</td>
                      <td style={styles.td}>{row.status}</td>
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ ...styles.td, textAlign: 'center' }}>Tidak ada data mentah.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333', margin: 0 }, 
  tableHeaderContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  
  exportButtonXLSX: { backgroundColor: '#1D5D50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  exportButtonPDF: { backgroundColor: '#c0392b', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },

  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
  filterContainer: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', flexDirection: 'column' },
  filterLabel: { fontSize: '14px', color: '#333', marginBottom: '4px', fontWeight: '500' },
  filterSelect: { padding: '8px 12px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc' }
};

export default StatsBulanan;