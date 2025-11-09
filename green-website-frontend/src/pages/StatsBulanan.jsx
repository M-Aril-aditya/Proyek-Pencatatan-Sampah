import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1D5D50', '#C0392B']; 

// Helper untuk Opsi Dropdown
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= 2023; i--) { // Mulai dari 2023 (atau sesuaikan)
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

  // State untuk Filter
  const jsDate = new Date();
  const [selectedYear, setSelectedYear] = useState(jsDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(jsDate.getMonth() + 1); // 1-12

  // --- (INI ADALAH FUNGSI useEffect YANG SUDAH DIPERBAIKI) ---
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
        // Panggil /api/stats UNTUK PIE CHART
        const statsRequest = axios.get('http://localhost:5000/api/stats', { params, headers });
        // Panggil /api/records UNTUK TABEL
        const recordsRequest = axios.get('http://localhost:5000/api/records', { params, headers });

        const [statsResponse, recordsResponse] = await Promise.all([
          statsRequest,
          recordsRequest
        ]);

        // Pie chart AMBIL DARI statsResponse
        const newPieData = statsResponse.data;
        // Tabel AMBIL DARI recordsResponse
        const newTableData = recordsResponse.data;

        // Hitung total HANYA dari data pie
        const newTotal = newPieData.reduce((sum, entry) => sum + entry.value, 0);

        setPieData(newPieData);
        setTotalWeight(newTotal);
        setTableData(newTableData); 
        
      } catch (error) {
        console.error('Error fetching monthly data:', error);
        setErrorMessage('Gagal mengambil data statistik bulanan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedYear, selectedMonth]); // Dependensi sudah benar

  // handleExport yang memanggil Backend (Sudah Benar)
  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');

    try {
      const response = await axios.get('http://localhost:5000/api/export/monthly', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          month: selectedMonth,
          year: selectedYear
        },
        responseType: 'blob', 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `laporan_bulanan_${selectedMonth}-${selectedYear}.xlsx`; 
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (filenameMatch && filenameMatch.length === 2) {
            filename = filenameMatch[1];
          }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting data:', error);
      setErrorMessage('Gagal mengekspor data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="content-section">
      <h2>Statistik Bulanan</h2>

      {/* Filter JSX (Sudah Benar) */}
      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Tahun:</label>
          <select 
            style={styles.filterSelect}
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {generateYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Bulan:</label>
          <select 
            style={styles.filterSelect}
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {monthOptions.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Pie Chart JSX (Sudah Benar) */}
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

      {/* Tabel Data Mentah JSX (Sudah Benar) */}
      {!isLoading && (
        <div style={styles.previewContainer}>
          <div style={styles.tableHeaderContainer}>
            <h3 style={styles.previewTitle}>Data Mentah (Bulan Ini)</h3>
            <button onClick={handleExport} style={styles.exportButton} disabled={isExporting}>
              {isExporting ? 'Mengekspor...' : 'Ekspor ke XLSX'}
            </button>
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

// Styles (Sudah Benar)
const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333', margin: 0 }, 
  tableHeaderContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  exportButton: { backgroundColor: '#1D5D50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
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