import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#27ae60', '#f39c12', '#c0392b']; 

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= 2023; i--) { 
    years.push(i);
  }
  return years;
};

function StatsTahunan() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const jsDate = new Date();
  const [selectedYear, setSelectedYear] = useState(jsDate.getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/'); return; }

      const params = { 
        range: 'yearly',
        year: selectedYear
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
        console.error('Error fetching yearly data:', error);
        setErrorMessage('Gagal mengambil data statistik tahunan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedYear]); 

  const loadScript = (src) => { return new Promise((resolve) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; document.body.appendChild(s); }); };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');

      const reportData = {};
      const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      for (let m = 0; m < 12; m++) {
        reportData[m] = { 'Area Kantor':{o:0,a:0,r:0}, 'Area Parkir':{o:0,a:0,r:0}, 'Area Makan':{o:0,a:0,r:0}, 'Area Ruang Tunggu':{o:0,a:0,r:0} };
      }

      tableData.forEach(row => {
        const dateObj = new Date(row.recorded_at);
        const monthIndex = dateObj.getMonth(); 
        let area = row.area_label || '';
        let w = parseFloat(row.weight_kg) || 0;
        let key = null;
        if (area.toLowerCase().includes('kantor')) key = 'Area Kantor';
        else if (area.toLowerCase().includes('parkir')) key = 'Area Parkir';
        else if (area.toLowerCase().includes('makan')) key = 'Area Makan';
        else if (area.toLowerCase().includes('tunggu')) key = 'Area Ruang Tunggu';

        if (key) {
            if (row.status === 'Organik Terpilah') reportData[monthIndex][key].o += w;
            else if (row.status === 'Anorganik Terpilah') reportData[monthIndex][key].a += w;
            else reportData[monthIndex][key].r += w;
        }
      });

      const totals = { k_o:0, k_a:0, k_r:0, k_t:0, p_o:0, p_a:0, p_r:0, p_t:0, m_o:0, m_a:0, m_r:0, m_t:0, t_o:0, t_a:0, t_r:0, t_t:0, grand:0 };
      const body = [];
      // HEADER 1-3 SAMA SEPERTI BULANAN (Ganti Tanggal jadi Bulan)
      // (Saya copy struktur header dari bulanan tapi ganti text)
      const headerRow1 = [
        { text: 'No', rowSpan: 3, style: 'tableHeader' },
        { text: 'Bulan', rowSpan: 3, style: 'tableHeader' },
        { text: 'Area Kantor', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Parkir', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Makan', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'Area Ruang Tunggu', colSpan: 4, style: 'tableHeader' }, {}, {}, {},
        { text: 'TOTAL', rowSpan: 3, style: 'tableHeader' } 
      ];
      const headerRow2 = [ {}, {}, { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' }, { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' }, { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' }, { text: 'Org', style: 'tableHeader' }, { text: 'Anorg', style: 'tableHeader' }, { text: 'Lain', style: 'tableHeader' }, { text: 'Jml', style: 'tableHeader' }, {} ];
      const headerRow3 = [{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {},{},{},{}, {}];
      body.push(headerRow1); body.push(headerRow2); body.push(headerRow3);

      for (let m = 0; m < 12; m++) {
          const r = reportData[m];
          const kt=r['Area Kantor'].o+r['Area Kantor'].a+r['Area Kantor'].r;
          const pt=r['Area Parkir'].o+r['Area Parkir'].a+r['Area Parkir'].r;
          const mt=r['Area Makan'].o+r['Area Makan'].a+r['Area Makan'].r;
          const tt=r['Area Ruang Tunggu'].o+r['Area Ruang Tunggu'].a+r['Area Ruang Tunggu'].r;
          const dt=kt+pt+mt+tt;

          totals.k_o+=r['Area Kantor'].o; totals.k_a+=r['Area Kantor'].a; totals.k_r+=r['Area Kantor'].r; totals.k_t+=kt;
          totals.p_o+=r['Area Parkir'].o; totals.p_a+=r['Area Parkir'].a; totals.p_r+=r['Area Parkir'].r; totals.p_t+=pt;
          totals.m_o+=r['Area Makan'].o; totals.m_a+=r['Area Makan'].a; totals.m_r+=r['Area Makan'].r; totals.m_t+=mt;
          totals.t_o+=r['Area Ruang Tunggu'].o; totals.t_a+=r['Area Ruang Tunggu'].a; totals.t_r+=r['Area Ruang Tunggu'].r; totals.t_t+=tt;
          totals.grand += dt;

          body.push([
            { text: (m+1).toString(), style: 'tableCell' }, { text: monthNames[m], style: 'tableCell' },
            { text: r['Area Kantor'].o||'-', style:'tableCell' }, { text: r['Area Kantor'].a||'-', style:'tableCell' }, { text: r['Area Kantor'].r||'-', style:'tableCell' }, { text: kt||'-', style:'tableBold' },
            { text: r['Area Parkir'].o||'-', style:'tableCell' }, { text: r['Area Parkir'].a||'-', style:'tableCell' }, { text: r['Area Parkir'].r||'-', style:'tableCell' }, { text: pt||'-', style:'tableBold' },
            { text: r['Area Makan'].o||'-', style:'tableCell' }, { text: r['Area Makan'].a||'-', style:'tableCell' }, { text: r['Area Makan'].r||'-', style:'tableCell' }, { text: mt||'-', style:'tableBold' },
            { text: r['Area Ruang Tunggu'].o||'-', style:'tableCell' }, { text: r['Area Ruang Tunggu'].a||'-', style:'tableCell' }, { text: r['Area Ruang Tunggu'].r||'-', style:'tableCell' }, { text: tt||'-', style:'tableBold' },
            { text: dt.toFixed(2), style: 'tableBold' }
          ]);
      }

      const daysInYear = (selectedYear%4===0) ? 366 : 365;
      // Footer Kg
      body.push([
          { text:'Total (kg)', colSpan:2, style:'bold', fillColor:'#ffe0b2' }, {},
          { text: totals.k_o.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.k_a.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.k_r.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.k_t.toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: totals.p_o.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.p_a.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.p_r.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.p_t.toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: totals.m_o.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.m_a.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.m_r.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.m_t.toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: totals.t_o.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.t_a.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.t_r.toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: totals.t_t.toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: totals.grand.toFixed(2), style:'bold', fillColor:'#ffe0b2' }
      ]);
      // Footer Ton
      body.push([
          { text:'Total (ton)', colSpan:2, style:'bold', fillColor:'#ffccbc' }, {},
          { text: (totals.k_o/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.k_a/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.k_r/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.k_t/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' },
          { text: (totals.p_o/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.p_a/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.p_r/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.p_t/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' },
          { text: (totals.m_o/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.m_a/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.m_r/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.m_t/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' },
          { text: (totals.t_o/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.t_a/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.t_r/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }, { text: (totals.t_t/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' },
          { text: (totals.grand/1000).toFixed(3), style:'bold', fillColor:'#ffccbc' }
      ]);
      // Footer Avg
      body.push([
          { text:'Rata-rata (kg/hari)', colSpan:2, style:'bold', fillColor:'#ffe0b2' }, {},
          { text: (totals.k_o/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.k_a/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.k_r/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.k_t/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: (totals.p_o/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.p_a/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.p_r/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.p_t/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: (totals.m_o/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.m_a/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.m_r/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.m_t/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: (totals.t_o/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.t_a/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.t_r/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }, { text: (totals.t_t/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' },
          { text: (totals.grand/daysInYear).toFixed(2), style:'bold', fillColor:'#ffe0b2' }
      ]);

      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content: [
          { text: `REKAMAN TIMBULAN SAMPAH - TAHUN ${selectedYear}`, style: 'header' },
          { text: 'PT. Dexa Medica Palembang', style: 'subheader' },
          {
            style: 'tableExample',
            table: {
              headerRows: 3,
              widths: [15, 30,  22,22,22,25,  22,22,22,25,  22,22,22,25,  22,22,22,25, 35],
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

      window.pdfMake.createPdf(docDefinition).download(`Laporan Timbulan Sampah Tahun ${selectedYear}.pdf`);

    } catch (error) { console.error(error); alert('Gagal membuat PDF'); } finally { setIsExporting(false); }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    try {
      const response = await axios.get('https://proyek-pencatatan-sampah.vercel.app/api/export/yearly', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { year: selectedYear },
        responseType: 'blob', 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let filename = `Laporan Timbulan Sampah Tahun ${selectedYear}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); setErrorMessage('Gagal mengekspor Excel.'); } finally { setIsExporting(false); }
  };

  return (
    <div className="content-section">
      <h2>Statistik Tahunan</h2>

      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Tahun:</label>
          <select style={styles.filterSelect} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {generateYearOptions().map(year => <option key={year} value={year}>{year}</option>)}
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
            <h3 style={styles.previewTitle}>Data Mentah (Tahun Ini)</h3>
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

export default StatsTahunan;