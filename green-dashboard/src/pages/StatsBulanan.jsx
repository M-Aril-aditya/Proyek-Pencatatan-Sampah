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
        const statsRequest = axios.get('https://proyek-pencatatan-sampah.vercel.app/api/stats', { params, headers });
        const recordsRequest = axios.get('https://proyek-pencatatan-sampah.vercel.app/api/records', { params, headers });

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

  // --- LOGIKA PDF MATRIKS (Sama seperti sebelumnya) ---
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
      // Header
      const headerRow1 = [
        { text: 'No', rowSpan: 3, style: 'tableHeader' },
        { text: 'Tgl', rowSpan: 3, style: 'tableHeader' },
        { text: 'Area Kantor', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Parkir', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Makan', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Ruang Tunggu', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'TOTAL HARIAN', rowSpan: 3, style: 'tableHeader' } 
      ];
      const headerRow2 = [
        {}, {},
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' },
        {}
      ];
      const headerRow3 = [{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {}];
      body.push(headerRow1);
      body.push(headerRow2);
      body.push(headerRow3);

      // Loop Data & Accumulate
      const totals = { k_o:0, k_a:0, k_r:0, k_t:0, p_o:0, p_a:0, p_r:0, p_t:0, m_o:0, m_a:0, m_r:0, m_t:0, t_o:0, t_a:0, t_r:0, t_t:0, grand:0 };

      for (let d = 1; d <= daysInMonth; d++) {
        const r = reportData[d];
        const kt = r['Area Kantor'].organik + r['Area Kantor'].anorganik + r['Area Kantor'].residu;
        const pt = r['Area Parkir'].organik + r['Area Parkir'].anorganik + r['Area Parkir'].residu;
        const mt = r['Area Makan'].organik + r['Area Makan'].anorganik + r['Area Makan'].residu;
        const tt = r['Area Ruang Tunggu'].organik + r['Area Ruang Tunggu'].anorganik + r['Area Ruang Tunggu'].residu;
        const dt = kt + pt + mt + tt;

        totals.k_o+=r['Area Kantor'].organik; totals.k_a+=r['Area Kantor'].anorganik; totals.k_r+=r['Area Kantor'].residu; totals.k_t+=kt;
        totals.p_o+=r['Area Parkir'].organik; totals.p_a+=r['Area Parkir'].anorganik; totals.p_r+=r['Area Parkir'].residu; totals.p_t+=pt;
        totals.m_o+=r['Area Makan'].organik; totals.m_a+=r['Area Makan'].anorganik; totals.m_r+=r['Area Makan'].residu; totals.m_t+=mt;
        totals.t_o+=r['Area Ruang Tunggu'].organik; totals.t_a+=r['Area Ruang Tunggu'].anorganik; totals.t_r+=r['Area Ruang Tunggu'].residu; totals.t_t+=tt;
        totals.grand += dt;

        body.push([
            { text: d.toString(), style: 'tableCell' }, { text: d.toString(), style: 'tableCell' },
            { text: r['Area Kantor'].organik||'-', style:'tableCell' }, { text: r['Area Kantor'].anorganik||'-', style:'tableCell' }, { text: r['Area Kantor'].residu||'-', style:'tableCell' }, { text: kt||'-', style:'tableBold' },
            { text: r['Area Parkir'].organik||'-', style:'tableCell' }, { text: r['Area Parkir'].anorganik||'-', style:'tableCell' }, { text: r['Area Parkir'].residu||'-', style:'tableCell' }, { text: pt||'-', style:'tableBold' },
            { text: r['Area Makan'].organik||'-', style:'tableCell' }, { text: r['Area Makan'].anorganik||'-', style:'tableCell' }, { text: r['Area Makan'].residu||'-', style:'tableCell' }, { text: mt||'-', style:'tableBold' },
            { text: r['Area Ruang Tunggu'].organik||'-', style:'tableCell' }, { text: r['Area Ruang Tunggu'].anorganik||'-', style:'tableCell' }, { text: r['Area Ruang Tunggu'].residu||'-', style:'tableCell' }, { text: tt||'-', style:'tableBold' },
            { text: dt.toFixed(2), style: 'tableBold' }
        ]);
      }

      // Footer (Kg)
      body.push([
          { text: 'Total (kg)', colSpan: 2, style: 'tableHeader', alignment:'left', fillColor: '#ffe0b2' }, {},
          { text: totals.k_o.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.k_a.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.k_r.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.k_t.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: totals.p_o.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.p_a.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.p_r.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.p_t.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: totals.m_o.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.m_a.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.m_r.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.m_t.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: totals.t_o.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.t_a.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.t_r.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: totals.t_t.toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: totals.grand.toFixed(2), style: 'tableHeader', fillColor: '#ffe0b2' }
      ]);
      // Footer (Ton)
      body.push([
          { text: 'Total (ton)', colSpan: 2, style: 'tableHeader', alignment:'left', fillColor: '#ffccbc' }, {},
          { text: (totals.k_o/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.k_a/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.k_r/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.k_t/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (totals.p_o/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.p_a/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.p_r/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.p_t/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (totals.m_o/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.m_a/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.m_r/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.m_t/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (totals.t_o/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.t_a/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.t_r/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' }, { text: (totals.t_t/1000).toFixed(3), style: 'tableBold', fillColor: '#ffccbc' },
          { text: (totals.grand/1000).toFixed(3), style: 'tableHeader', fillColor: '#ffccbc' }
      ]);
      // Footer (Avg)
      body.push([
          { text: 'Rata-rata (kg/hari)', colSpan: 2, style: 'tableHeader', alignment:'left', fillColor: '#ffe0b2' }, {},
          { text: (totals.k_o/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.k_a/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.k_r/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.k_t/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (totals.p_o/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.p_a/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.p_r/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.p_t/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (totals.m_o/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.m_a/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.m_r/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.m_t/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (totals.t_o/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.t_a/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.t_r/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' }, { text: (totals.t_t/daysInMonth).toFixed(2), style: 'tableBold', fillColor: '#ffe0b2' },
          { text: (totals.grand/daysInMonth).toFixed(2), style: 'tableHeader', fillColor: '#ffe0b2' }
      ]);

      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content: [
          { text: `REKAMAN TIMBULAN SAMPAH - ${selectedMonth}/${selectedYear}`, style: 'header' },
          { text: 'PT. Dexa Medica Palembang', style: 'subheader' },
          {
            style: 'tableExample',
            table: {
              headerRows: 3,
              widths: [15, 15,  22,22,22,25,  22,22,22,25,  22,22,22,25,  22,22,22,25, 35],
              body: body
            },
            layout: { fillColor: function (rowIndex) { return (rowIndex < 3 || rowIndex >= body.length - 3) ? '#f1c40f' : null; } }
          }
        ],
        styles: {
          header: { fontSize: 14, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
          subheader: { fontSize: 10, margin: [0, 0, 0, 10], alignment: 'center' },
          tableHeader: { bold: true, fontSize: 6, color: 'black', alignment: 'center' },
          tableCell: { fontSize: 6, alignment: 'center' },
          tableBold: { fontSize: 6, bold: true, alignment: 'center' }
        }
      };

      window.pdfMake.createPdf(docDefinition).download(`Laporan Timbulan Sampah Bulan ${selectedMonth}-${selectedYear}.pdf`);

    } catch (error) { console.error(error); alert('Gagal membuat PDF'); } finally { setIsExporting(false); }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    try {
      const response = await axios.get('https://proyek-pencatatan-sampah.vercel.app/api/export/monthly', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear },
        responseType: 'blob', 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let filename = `Laporan Timbulan Sampah Bulan ${selectedMonth}-${selectedYear}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); setErrorMessage('Gagal mengekspor Excel.'); } finally { setIsExporting(false); }
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
                  {/* KOLOM NO */}
                  <th style={{...styles.th, width:'50px', textAlign:'center'}}>No</th>
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
                      {/* ISI NO */}
                      <td style={{...styles.td, textAlign:'center'}}>{index + 1}</td>
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
                    {/* Colspan 8 */}
                    <td colSpan="8" style={{ ...styles.td, textAlign: 'center' }}>Tidak ada data mentah.</td>
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