import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1D5D50', '#C0392B']; // Hijau (Terkelola), Merah (Tidak Terkelola)

// 1. Ganti nama fungsi
function StatsMingguan() {
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

      // 2. Ganti parameter 'range'
      const params = { range: 'weekly' }; // <-- PERUBAHAN DI SINI
      
      try {
        const recordsResponse = await axios.get('http://localhost:5000/api/records', { 
          params, headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const rawData = recordsResponse.data;
        
        // --- LOGIKA PERBAIKAN BARU ---
        // Logika ini (mencari 'TERKELOLA' dan 'TIDAK TERKELOLA')
        // tetap sama persis seperti di StatsHarian.
        
        let finalTerkelola = 0;
        let finalTidakTerkelola = 0;

        rawData.forEach(row => {
          const weight = parseFloat(row.weight_kg) || 0;

          if (row.item_label === 'TERKELOLA') {
            finalTerkelola += weight; 
          } else if (row.item_label === 'TIDAK TERKELOLA') {
            finalTidakTerkelola += weight;
          }
        });
        // --- AKHIR DARI LOGIKA ---

        const newPieData = [
          { name: 'Terkelola', value: finalTerkelola },       
          { name: 'Tidak Terkelola', value: finalTidakTerkelola }
        ];
        
        const newTotal = finalTerkelola + finalTidakTerkelola;

        setPieData(newPieData);
        setTotalWeight(newTotal); 
        setTableData(rawData); 
        
      } catch (error) {
        console.error('Error fetching weekly data:', error);
        if (error.response) {
          console.error('Data error:', error.response.data);
          console.error('Status error:', error.response.status);
        }
        // 3. Ganti pesan error
        setErrorMessage('Gagal mengambil data statistik mingguan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  return (
    <div className="content-section">
      {/* 4. Ganti Judul */}
      <h2>Statistik Mingguan (% Terkelola)</h2>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      // 5. Ganti pesan 'jika kosong'
      : totalWeight === 0 ? ( <p>Belum ada data summary (TERKELOLA/TIDAK TERKELOLA) untuk minggu ini.</p> )
      : (
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

      {!isLoading && (
        <div style={styles.previewContainer}>
          {/* 6. Ganti sub-judul tabel */}
          <h3 style={styles.previewTitle}>Data Mentah (Minggu Ini)</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Area</th>
                  <th style={styles.th}>Seksi</th>
                  <th style={styles.th}>Nama Item</th>
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
                      <td style={styles.td}>{row.section_title}</td>
                      <td style={styles.td}>{row.item_label}</td>
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ ...styles.td, textAlign: 'center' }}>Tidak ada data mentah.</td>
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

// Objek Styles (Tetap sama)
const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333' },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

// 7. Ganti export
export default StatsMingguan;