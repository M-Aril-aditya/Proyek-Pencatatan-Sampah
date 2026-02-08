import React, { useState, useEffect, useMemo } from 'react';
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

const monthOptions = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
  { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
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

  // --- STATE BARU UNTUK FILTER TABEL ---
  const [filterArea, setFilterArea] = useState('Semua');
  const [filterItem, setFilterItem] = useState('Semua');

  // --- FUNGSI FETCH DATA (DIPISAH AGAR BISA REFRESH) ---
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    
    // Reset filter saat ganti bulan/tahun
    setFilterArea('Semua');
    setFilterItem('Semua');

    const params = { range: 'monthly', year: selectedYear, month: selectedMonth }; 
    const headers = { 'Authorization': `Bearer ${token}` };
    
    try {
      const baseURL = 'proyek-pencatatan-sampah.vercel.app'; // Pastikan URL ini benar
      const statsRequest = axios.get(`${baseURL}/api/stats`, { params, headers });
      const recordsRequest = axios.get(`${baseURL}/api/records`, { params, headers });

      const [statsResponse, recordsResponse] = await Promise.all([statsRequest, recordsRequest]);

      setPieData(statsResponse.data);
      setTableData(recordsResponse.data);
      const newTotal = statsResponse.data.reduce((sum, entry) => sum + entry.value, 0);
      setTotalWeight(newTotal);
      
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal mengambil data statistik bulanan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate, selectedYear, selectedMonth]); 

  // --- FUNGSI HAPUS DATA ---
  const handleDeleteRow = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini secara permanen?")) return;

    try {
      const token = localStorage.getItem('adminToken');
      const baseURL = 'http://localhost:3000'; // Sesuaikan URL Backend

      await axios.delete(`${baseURL}/api/records/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      alert("Data berhasil dihapus!");
      fetchData(); // Refresh Data Tabel & Chart

    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Gagal menghapus data.");
    }
  };

  // --- LOGIKA FILTER (BARU) ---
  const uniqueAreas = useMemo(() => {
    const areas = tableData.map(row => row.area_label).filter(Boolean);
    return ['Semua', ...new Set(areas)];
  }, [tableData]);

  const uniqueItems = useMemo(() => {
    const items = tableData.map(row => row.item_label).filter(Boolean);
    return ['Semua', ...new Set(items)];
  }, [tableData]);

  const filteredData = useMemo(() => {
    return tableData.filter(row => {
      const areaMatch = filterArea === 'Semua' || row.area_label === filterArea;
      const itemMatch = filterItem === 'Semua' || row.item_label === filterItem;
      return areaMatch && itemMatch;
    });
  }, [tableData, filterArea, filterItem]);

  // --- LOGIKA PDF (CLIENT SIDE) ---
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

      const itemStructure = {
        organik: ['Daun Kering', 'Sisa Makanan'],
        anorganik: ['Kertas', 'Kardus', 'Plastik', 'Duplex', 'Kantong'],
        residu: ['Drum Vat', 'Residu'] // Vial & Botol dihapus
      };
      const keywords = {
        'Daun Kering': ['daun', 'kering'], 'Sisa Makanan': ['sisa', 'makan'],
        'Kertas': ['kertas'], 'Kardus': ['kardus'], 'Plastik': ['plastik'], 'Duplex': ['duplex'], 'Kantong': ['kantong', 'kresek'],
        'Drum Vat': ['drum', 'vat'], 'Residu': ['residu', 'lain']
      };

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const areaList = ['Area Kantor', 'Area Parkir', 'Area Makan', 'Area Ruang Tunggu'];
      
      const reportData = {};
      for (let d = 1; d <= daysInMonth; d++) {
        reportData[d] = {};
        areaList.forEach(area => {
            reportData[d][area] = {};
            [...itemStructure.organik, ...itemStructure.anorganik, ...itemStructure.residu].forEach(item => {
                reportData[d][area][item] = 0;
            });
        });
      }

      tableData.forEach(row => {
        const dateObj = new Date(row.recorded_at);
        const day = dateObj.getDate();
        let area = row.area_label ? row.area_label.trim() : '';
        const itemLabel = row.item_label ? row.item_label.toLowerCase() : '';
        const weight = parseFloat(row.weight_kg) || 0;

        let targetAreaKey = null;
        if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
        else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
        else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
        else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

        if (targetAreaKey && reportData[day]) {
            let matched = false;
            for (const [header, keys] of Object.entries(keywords)) {
                if (keys.some(k => itemLabel.includes(k))) {
                    reportData[day][targetAreaKey][header] += weight;
                    matched = true;
                    break;
                }
            }
            if (!matched) reportData[day][targetAreaKey]['Residu'] += weight;
        }
      });

      const content = [];
      content.push({ text: `LAPORAN TIMBULAN SAMPAH - BULAN ${selectedMonth}/${selectedYear}`, style: 'header' });
      content.push({ text: 'PT. Dexa Medica Palembang', style: 'subheader' });

      areaList.forEach((area, index) => {
          content.push({ text: area.toUpperCase(), style: 'areaTitle', margin: [0, 15, 0, 5] });
          const body = [];
          
          const row1 = [
              { text: 'Tgl', rowSpan: 2, style: 'tableHeader', margin: [0, 5, 0, 0] },
              { text: 'Organik', colSpan: itemStructure.organik.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.organik.length).fill({}), 
              { text: 'Anorganik', colSpan: itemStructure.anorganik.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.anorganik.length).fill({}),
              { text: 'Residu', colSpan: itemStructure.residu.length + 1, style: 'catHeader', fillColor: '#FFFF00' },
              ...Array(itemStructure.residu.length).fill({}),
              { text: 'TOTAL', rowSpan: 2, style: 'tableHeader', margin: [0, 5, 0, 0] }
          ];
          
          const row2 = [ {} ];
          itemStructure.organik.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          itemStructure.anorganik.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          itemStructure.residu.forEach(i => row2.push({ text: i, style: 'itemHeader' }));
          row2.push({ text: 'Jml', style: 'itemHeaderBold' }); 
          row2.push({}); 

          body.push(row1);
          body.push(row2);

          const colTotals = new Array(row2.length).fill(0); 

          for (let d = 1; d <= daysInMonth; d++) {
              const r = reportData[d][area];
              const rowData = [ { text: d.toString(), style: 'tableCell' } ];
              let colIdx = 1;

              let subOrg = 0;
              itemStructure.organik.forEach(i => {
                  const val = r[i] || 0; subOrg += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subOrg || '-', style: 'tableBold' }); 
              colTotals[colIdx++] += subOrg;

              let subAnorg = 0;
              itemStructure.anorganik.forEach(i => {
                  const val = r[i] || 0; subAnorg += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subAnorg || '-', style: 'tableBold' });
              colTotals[colIdx++] += subAnorg;

              let subRes = 0;
              itemStructure.residu.forEach(i => {
                  const val = r[i] || 0; subRes += val;
                  rowData.push({ text: val || '-', style: 'tableCell' });
                  colTotals[colIdx++] += val;
              });
              rowData.push({ text: subRes || '-', style: 'tableBold' });
              colTotals[colIdx++] += subRes;

              const dailyTotal = subOrg + subAnorg + subRes;
              rowData.push({ text: dailyTotal.toFixed(1), style: 'tableBold' });
              colTotals[colIdx++] += dailyTotal;

              body.push(rowData);
          }

          const footerRowKg = [ { text: 'Total (kg/bln)', style: 'footerLabel', fillColor: '#FFE0B2' } ];
          for(let c=1; c<colTotals.length; c++) {
              footerRowKg.push({ text: colTotals[c].toFixed(1), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowKg);

          const footerRowTon = [ { text: 'Total (ton/bln)', style: 'footerLabel', fillColor: '#FFE0B2' } ];
          for(let c=1; c<colTotals.length; c++) {
              const valTon = colTotals[c] / 1000;
              footerRowTon.push({ text: valTon.toFixed(3), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowTon);

          const footerRowAvg = [ { text: 'Rata-rata (kg/hr)', style: 'footerLabel', fillColor: '#FFE0B2' } ];
          for(let c=1; c<colTotals.length; c++) {
              const valAvg = colTotals[c] / daysInMonth;
              footerRowAvg.push({ text: valAvg.toFixed(2), style: 'tableBold', fillColor: '#FFE0B2' });
          }
          body.push(footerRowAvg);

          content.push({
              style: 'tableExample',
              table: {
                  headerRows: 2,
                  widths: Array(body[0].length).fill('*'),
                  body: body
              },
              layout: {
                  fillColor: function (rowIndex) { return (rowIndex < 2) ? '#eeeeee' : null; }
              }
          });
          
          if(index < areaList.length - 1) content.push({ text: '', pageBreak: 'after' });
      });

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

      window.pdfMake.createPdf(docDefinition).download(`Laporan_Detail_Area_${selectedMonth}-${selectedYear}.pdf`);

    } catch (error) { 
        console.error(error); 
        alert('Gagal membuat PDF. Coba lagi.'); 
    } finally { 
        setIsExporting(false); 
    }
  };

  // --- EXCEL EXPORT (HIT BACKEND) ---
  const handleExportXLSX = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    try {
      const baseURL = 'http://localhost:3000'; // Pastikan URL ini benar
      const response = await axios.get(`${baseURL}/api/export/monthly`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear },
        responseType: 'blob', 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let filename = `Laporan_Bulanan_${selectedMonth}-${selectedYear}.xlsx`;
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
        <h2>Statistik Bulanan</h2>
      </div>

      {/* FILTER TAHUN & BULAN */}
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
                   label={({ percent }) => `${(percent * 100).toFixed(0)}%`} 
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
                <h3 style={styles.previewTitle}>Data Mentah (Bulan Ini)</h3>
                <span style={{ fontSize: '0.9rem', color: '#1D5D50', fontWeight: 'bold' }}>
                  Total (Filtered): {filteredData.reduce((acc, curr) => acc + parseFloat(curr.weight_kg || 0), 0).toFixed(2)} Kg
                </span>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleExportXLSX} style={styles.exportButtonXLSX} disabled={isExporting}>
                  {isExporting ? '...' : 'Ekspor Excel'}
                </button>
                <button onClick={handleExportPDF} style={styles.exportButtonPDF} disabled={isExporting}>
                  {isExporting ? '...' : 'Ekspor PDF (Per Area)'}
                </button>
            </div>
          </div>

          {/* --- FILTER TABLE UI (DROPDOWNS) --- */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            {/* Filter Area */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Filter Area:</label>
                <select 
                    value={filterArea} 
                    onChange={(e) => setFilterArea(e.target.value)}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    {uniqueAreas.map(area => (
                        <option key={area} value={area}>{area}</option>
                    ))}
                </select>
            </div>

            {/* Filter Item */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Filter Sampah:</label>
                <select 
                    value={filterItem} 
                    onChange={(e) => setFilterItem(e.target.value)}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    {uniqueItems.map(item => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, width:'50px', textAlign:'center'}}>No</th>
                  <th style={styles.th}>Tanggal</th>
                  <th style={styles.th}>Area</th>
                  <th style={styles.th}>Nama Item</th>
                  {/* <th style={styles.th}>Pengelola</th> */}
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Bobot (Kg)</th>
                  <th style={styles.th}>Petugas</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => (
                    <tr key={index}>
                      <td style={{...styles.td, textAlign:'center'}}>{index + 1}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleDateString('id-ID')}</td>
                      <td style={styles.td}>{row.area_label}</td>
                      <td style={styles.td}>{row.item_label}</td>
                      {/* <td style={styles.td}>{row.pengelola}</td> */}
                      <td style={styles.td}>{row.status}</td>
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
                      
                      {/* TOMBOL HAPUS (BARU) */}
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <button 
                          onClick={() => handleDeleteRow(row.id)}
                          style={{
                            backgroundColor: '#ff4d4f', color: 'white', border: 'none', 
                            padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ ...styles.td, textAlign: 'center', padding: '20px', color: '#888' }}>
                        Tidak ada data yang sesuai filter.
                    </td>
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
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
  filterContainer: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', flexDirection: 'column' },
  filterLabel: { fontSize: '14px', color: '#333', marginBottom: '4px', fontWeight: '500' },
  filterSelect: { padding: '8px 12px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '150px' }
};

export default StatsBulanan;