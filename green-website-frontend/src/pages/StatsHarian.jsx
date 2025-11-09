import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1D5D50', '#C0392B']; // Hijau (Terkelola), Merah (Tidak Terkelola)

function StatsHarian() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/'); return; }

      // Parameter yang sama untuk kedua request
      const params = { range: 'daily' };
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        // --- (PERUBAHAN LOGIKA FETCHING) ---
        // Kita buat 2 permintaan API secara paralel

        const statsRequest = axios.get('http://localhost:5000/api/stats', { params, headers });
        const recordsRequest = axios.get('http://localhost:5000/api/records', { params, headers });

        // Tunggu keduanya selesai
        const [statsResponse, recordsResponse] = await Promise.all([
          statsRequest,
          recordsRequest
        ]);

        // 1. Data untuk Pie Chart (langsung dari /api/stats)
        const newPieData = statsResponse.data; // Ini adalah array [ { name, value }, { name, value } ]
        
        // 2. Data untuk Tabel (langsung dari /api/records)
        const newTableData = recordsResponse.data;

        // Hitung total bobot HANYA dari data pie
        const newTotal = newPieData.reduce((sum, entry) => sum + entry.value, 0);

        setPieData(newPieData);
        setTotalWeight(newTotal);
        setTableData(newTableData); 
        // --- (AKHIR PERUBAHAN LOGIKA) ---
        
      } catch (error) {
        console.error('Error fetching daily data:', error);
        if (error.response) {
          console.error('Data error:', error.response.data);
          console.error('Status error:', error.response.status);
        }
        setErrorMessage('Gagal mengambil data statistik harian.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate]); // Dependensi 'navigate' sudah benar

  return (
    <div className="content-section">
      <h2>Statistik Harian</h2>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      : totalWeight === 0 ? ( <p>Belum ada data untuk hari ini.</p> )
      : (
        // --- (BAGIAN PIE CHART TIDAK BERUBAH) ---
        <div style={{ width: '100%', height: 300, marginBottom: '2rem' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie 
                data={pieData} 
                cx="50%" 
                cy="50%" 
                labelLine={false} 
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} 
                outerRadius={100} 
                fill="#8884d8" 
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value.toFixed(2)} Kg`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* --- (PERUBAHAN PADA TABEL DATA MENTAH) --- */}
      {!isLoading && (
        <div style={styles.previewContainer}>
          <h3 style={styles.previewTitle}>Data Mentah</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Area</th>
                  {/* <th style={styles.th}>Seksi</th> <-- DIHAPUS */ }
                  <th style={styles.th}>Nama Item</th>
                  <th style={styles.th}>Pengelola</th> {/* <-- DITAMBAH */}
                  <th style={styles.th}>Status</th>     {/* <-- DITAMBAH */}
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
                      {/* <td style={styles.td}>{row.section_title}</td> <-- DIHAPUS */ }
                      <td style={styles.td}>{row.item_label}</td>
                      <td style={styles.td}>{row.pengelola}</td> {/* <-- DITAMBAH */}
                      <td style={styles.td}>{row.status}</td>     {/* <-- DITAMBAH */}
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    {/* colSpan sekarang 7 (karena ada 7 kolom) */}
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

// Objek Styles (TIDAK BERUBAH)
const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333' },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

export default StatsHarian;