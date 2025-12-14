import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- WARNA CHART ---
const COLORS = ['#4CAF50', '#F44336']; 

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= 2023; i--) { years.push(i); }
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
      
      const params = { range: 'yearly', year: selectedYear }; 
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        const baseURL = 'http://localhost:5000'; 
        const statsRequest = axios.get(`${baseURL}/api/stats`, { params, headers });
        const recordsRequest = axios.get(`${baseURL}/api/records`, { params, headers });

        const [statsResponse, recordsResponse] = await Promise.all([statsRequest, recordsRequest]);

        setPieData(statsResponse.data);
        setTableData(recordsResponse.data);
        const newTotal = statsResponse.data.reduce((sum, entry) => sum + entry.value, 0);
        setTotalWeight(newTotal);
        
      } catch (error) {
        console.error(error);
        setErrorMessage('Gagal mengambil data statistik tahunan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedYear]); 

  // --- LOGIKA PDF DETAIL (TAHUNAN) ---
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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');

      // 1. Struktur Item Detail
      const itemStructure = {
        organik: ['Daun Kering', 'Sisa Makanan'],
        anorganik: ['Kertas', 'Kardus', 'Plastik', 'Duplex', 'Kantong'],
        residu: ['Vial', 'Botol', 'Drum Vat', 'Residu']
      };
      const keywords = {
        'Daun Kering': ['daun', 'kering'], 'Sisa Makanan': ['sisa', 'makan'],
        'Kertas': ['kertas'], 'Kardus': ['kardus'], 'Plastik': ['plastik'], 'Duplex': ['duplex'], 'Kantong': ['kantong', 'kresek'],
        'Vial': ['vial'], 'Botol': ['botol'], 'Drum Vat': ['drum', 'vat'], 'Residu': ['residu', 'lain']
      };

      const areaList = ['Area Kantor', 'Area Parkir', 'Area Makan', 'Area Ruang Tunggu'];
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      
      // Inisialisasi Data per Bulan (0-11)
      const reportData = {};
      for (let m = 0; m < 12; m++) {
        reportData[m] = {};
        areaList.forEach(area => {
            reportData[m][area] = {};
            [...itemStructure.organik, ...itemStructure.anorganik, ...itemStructure.residu].forEach(item => {
                reportData[m][area][item] = 0;
            });
        });
      }

      // Mapping Data Database ke Struktur Report
      tableData.forEach(row => {
        const dateObj = new Date(row.recorded_at);
        const monthIndex = dateObj.getMonth(); // 0 = Jan, 11 = Des
        let area = row.area_label ? row.area_label.trim() : '';
        const itemLabel = row.item_label ? row.item_label.toLowerCase() : '';
        const weight = parseFloat(row.weight_kg) || 0;

        let targetAreaKey = null;
        if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
        else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
        else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
        else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

        if (targetAreaKey && reportData[monthIndex]) {
            let matched = false;
            for (const [header, keys] of Object.entries(keywords)) {
                if (keys.some(k => itemLabel.includes(k))) {
                    reportData[monthIndex][targetAreaKey][header] += weight;
                    matched = true;
                    break;
                }
            }
            if (!matched) reportData[monthIndex][targetAreaKey]['Residu'] += weight;
        }
      });

      // 2. Generate Konten PDF (Per Area)
      const content = [];
      content.push({ text: `LAPORAN REKAPITULASI SAMPAH TAHUNAN - ${selectedYear}`, style: 'header' });
      content.push({ text: 'PT. Dexa Medica Palembang', style: 'subheader' });

      areaList.forEach((area, index) => {
          content.push({ text: area.toUpperCase(), style: 'areaTitle', margin: [0, 15, 0, 5] });

          const body = [];
          
          // Row 1: Header Kategori
          const row1 = [
              { text: 'No', rowSpan: 2, style: 'tableHeader', margin: [0, 5, 0, 0] },
              { text: 'Bulan', rowSpan: 2, style: 'tableHeader', margin: [0, 5, 0, 0] }, // Ubah Tgl jadi Bulan
              { text: 'Organik', colSpan: itemStructure.organik.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.organik.length).fill({}), 
              { text: 'Anorganik', colSpan: itemStructure.anorganik.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.anorganik.length).fill({}),
              { text: 'Residu', colSpan: itemStructure.residu.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.residu.length).fill({}),
              { text: 'TOTAL', rowSpan: 2, style: 'tableHeader', margin: [0, 5, 0, 0] }
          ];
          
          // Row 2: Header Item Name
          const row2 = [ {}, {} ];
          itemStructure.organik.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          itemStructure.anorganik.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          itemStructure.residu.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          row2.push({}); // Spacer Grand Total

          body.push(row1);
          body.push(row2);

          // Isi Data (Looping 12 Bulan)
          const colTotals = new Array(row2.length).fill(0); 

          for (let m = 0; m < 12; m++) {
              const r = reportData[m][area];
              const rowData = [ 
                  { text: (m+1).toString(), style: 'tableCell' }, 
                  { text: monthNames[m], style: 'tableCell' } // Nama Bulan
              ];
              let colIdx = 2; // Start after No & Bulan

              // Organik
              let subOrg = 0;
              itemStructure.organik.forEach(i => {
                  const val = r[i] || 0; subOrg += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subOrg || '-', style: 'tableBold' }); 
              colTotals[colIdx++] += subOrg;

              // Anorganik
              let subAnorg = 0;
              itemStructure.anorganik.forEach(i => {
                  const val = r[i] || 0; subAnorg += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subAnorg || '-', style: 'tableBold' });
              colTotals[colIdx++] += subAnorg;

              // Residu
              let subRes = 0;
              itemStructure.residu.forEach(i => {
                  const val = r[i] || 0; subRes += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subRes || '-', style: 'tableBold' });
              colTotals[colIdx++] += subRes;

              // Grand Total Bulanan
              const monthlyTotal = subOrg + subAnorg + subRes;
              rowData.push({ text: monthlyTotal.toFixed(1), style: 'tableBold' });
              colTotals[colIdx++] += monthlyTotal;

              body.push(rowData);
          }

          // --- FOOTER (3 BARIS) ---
          const daysInYear = (selectedYear % 4 === 0 && selectedYear % 100 > 0) || selectedYear % 400 === 0 ? 366 : 365;

          // 1. Total (kg/thn)
          const footerRowKg = [ { text: 'Total (kg/thn)', colSpan: 2, style: 'footerLabel', fillColor: '#FFE0B2' }, {} ];
          for(let c=2; c<colTotals.length; c++) {
              footerRowKg.push({ text: colTotals[c].toFixed(1), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowKg);

          // 2. Total (ton/thn)
          const footerRowTon = [ { text: 'Total (ton/thn)', colSpan: 2, style: 'footerLabel', fillColor: '#FFE0B2' }, {} ];
          for(let c=2; c<colTotals.length; c++) {
              const valTon = colTotals[c] / 1000;
              footerRowTon.push({ text: valTon.toFixed(3), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowTon);

          // 3. Rata-rata (kg/hari)
          const footerRowAvg = [ { text: 'Rata-rata (kg/hr)', colSpan: 2, style: 'footerLabel', fillColor: '#FFE0B2' }, {} ];
          for(let c=2; c<colTotals.length; c++) {
              const valAvg = colTotals[c] / daysInYear;
              footerRowAvg.push({ text: valAvg.toFixed(2), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowAvg);

          // Render Table
          content.push({
              style: 'tableExample',
              table: {
                  headerRows: 2,
                  widths: Array(body[0].length).fill('*'),
                  body: body
              },
              layout: { fillColor: function (rowIndex) { return (rowIndex < 2) ? '#eeeeee' : null; } }
          });
          
          if(index < areaList.length - 1) content.push({ text: '', pageBreak: 'after' });
      });

      // 3. Config PDF
      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content: content,
        styles: {
          header: { fontSize: 14, bold: true, alignment: 'center', margin: [0,0,0,5] },
          subheader: { fontSize: 10, alignment: 'center', margin: [0,0,0,10] },
          areaTitle: { fontSize: 12, bold: true, color: '#1D5D50', decoration: 'underline' },
          tableHeader: { bold: true, fontSize: 8, alignment: 'center' },
          catHeader: { bold: true, fontSize: 8, alignment: 'center', color: 'black' },
          itemHeader: { fontSize: 7, alignment: 'center', italics: true },
          itemHeaderBold: { fontSize: 7, bold: true, alignment: 'center' },
          tableCell: { fontSize: 8, alignment: 'center' },
          tableBold: { fontSize: 8, bold: true, alignment: 'center' },
          footerLabel: { fontSize: 7, bold: true, alignment: 'left' }
        }
      };

      window.pdfMake.createPdf(docDefinition).download(`Laporan_Tahunan_${selectedYear}.pdf`);

    } catch (error) { 
        console.error(error); 
        alert('Gagal membuat PDF. Coba lagi.'); 
    } finally { 
        setIsExporting(false); 
    }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    try {
      const baseURL = 'http://localhost:5000'; 
      const response = await axios.get(`${baseURL}/api/export/yearly`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { year: selectedYear },
        responseType: 'blob', 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let filename = `Laporan_Tahunan_${selectedYear}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); setErrorMessage('Gagal mengekspor Excel.'); } finally { setIsExporting(false); }
  };

  return (
    <div className="content-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Statistik Tahunan</h2>
      </div>

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
      : totalWeight === 0 ? ( <div style={{padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px'}}>Belum ada data untuk periode ini.</div> )
      : (
        <div style={{ width: '100%', marginBottom: '2rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{textAlign: 'center', marginBottom: '10px', color: '#555'}}>Persentase Pengelolaan</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                    data={pieData} 
                    cx="50%" cy="50%" 
                    labelLine={false} 
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} 
                    outerRadius={100} 
                    fill="#8884d8" 
                    dataKey="value"
                >
                  {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(2)} Kg`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{textAlign: 'center', marginTop: '10px', fontWeight: 'bold', color: '#333'}}>
             Total: <span style={{color: '#27ae60'}}>{totalWeight.toFixed(2)} Kg</span>
          </div>
        </div>
       )}

      {!isLoading && (
        <div style={styles.previewContainer}>
          <div style={styles.tableHeaderContainer}>
            <div style={{display: 'flex', flexDirection:'column'}}>
                <h3 style={styles.previewTitle}>Data Mentah (Tahun Ini)</h3>
                <span style={{ fontSize: '0.9rem', color: '#1D5D50', fontWeight: 'bold' }}>Total: {totalWeight.toFixed(2)} Kg</span>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleExportXLSX} style={styles.exportButtonXLSX} disabled={isExporting}>
                  {isExporting ? '...' : 'Ekspor Excel'}
                </button>
                <button onClick={handleExportPDF} style={styles.exportButtonPDF} disabled={isExporting}>
                  {isExporting ? '...' : 'Ekspor PDF (Detail)'}
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