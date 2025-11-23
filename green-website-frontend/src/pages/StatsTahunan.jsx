import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Warna Baru: Hijau (Organik), Kuning/Oranye (Anorganik), Merah (Residu)
const COLORS = ['#27ae60', '#f39c12', '#c0392b']; 

// Helper untuk Opsi Dropdown Tahun
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

  // State untuk Filter Tahun
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
        const statsRequest = axios.get('http://localhost:5000/api/stats', { params, headers });
        const recordsRequest = axios.get('http://localhost:5000/api/records', { params, headers });

        const [statsResponse, recordsResponse] = await Promise.all([
          statsRequest,
          recordsRequest
        ]);

        const newPieData = statsResponse.data;
        const newTableData = recordsResponse.data;
        const newTotal = newPieData.reduce((sum, entry) => sum + entry.value, 0);

        setPieData(newPieData);
        setTotalWeight(newTotal);
        setTableData(newTableData); 
        
      } catch (error) {
        console.error('Error fetching yearly data:', error);
        setErrorMessage('Gagal mengambil data statistik tahunan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedYear]); 

  // Helper Load Script untuk Export (Karena backend belum ada rute tahunan)
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.body.appendChild(script);
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage('');
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

      if (typeof window.XLSX === 'undefined') {
        throw new Error('XLSX library not loaded.');
      }

      const dataToExport = tableData.map(row => ({
        'Area': row.area_label,
        'Nama Item': row.item_label,
        'Pengelola': row.pengelola, // <-- Kolom baru
        'Status': row.status,     // <-- Kolom baru
        'Bobot (Kg)': parseFloat(row.weight_kg).toFixed(2),
        'Petugas': row.petugas_name,
        'Waktu Catat': new Date(row.recorded_at).toLocaleString('id-ID')
      }));

      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, `Data Tahun ${selectedYear}`);
      window.XLSX.writeFile(wb, `Laporan_Tahunan_${selectedYear}.xlsx`);

    } catch (error) {
      console.error('Error exporting data:', error);
      setErrorMessage('Gagal mengekspor data.');
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="content-section">
      <h2>Statistik Tahunan</h2>

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

export default StatsTahunan;