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

      const params = { range: 'daily' };
      
      try {
        const recordsResponse = await axios.get('http://localhost:5000/api/records', { 
          params, headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const rawData = recordsResponse.data;
        
        // --- LOGIKA PERBAIKAN BARU ---
        // Kita tidak akan menjumlahkan semua baris.
        // Kita HANYA akan mencari baris summary "TERKELOLA" dan "TIDAK TERKELOLA".
        
        let finalTerkelola = 0;
        let finalTidakTerkelola = 0;

        rawData.forEach(row => {
          const weight = parseFloat(row.weight_kg) || 0;

          // Kita cari berdasarkan 'item_label' (atau 'item_id' jika lebih unik)
          // Pastikan ejaan 'TERKELOLA' dan 'TIDAK TERKELOLA' sama persis
          // dengan yang ada di database/CSV Anda.
          if (row.item_label === 'TERKELOLA') {
            finalTerkelola += weight; // Menggunakan += untuk keamanan jika ada > 1 baris
          } else if (row.item_label === 'TIDAK TERKELOLA') {
            finalTidakTerkelola += weight;
          }
          
          // Semua baris data mentah lainnya (Kertas, Plastik, dll)
          // akan diabaikan oleh logika Pie Chart ini.
        });
        // --- AKHIR DARI LOGIKA PERBAIKAN ---

        // Data untuk Pie Chart sekarang HANYA berisi 142 dan 57
        const newPieData = [
          { name: 'Terkelola', value: finalTerkelola },       // Seharusnya 142.00
          { name: 'Tidak Terkelola', value: finalTidakTerkelola } // Seharusnya 57.00
        ];
        
        // Totalnya sekarang adalah 142.00 + 57.00 = 199.00
        const newTotal = finalTerkelola + finalTidakTerkelola;

        setPieData(newPieData);
        setTotalWeight(newTotal); // Total di tooltip akan menjadi 199.00 Kg
        setTableData(rawData); // Data tabel mentah TETAP menampilkan SEMUA data (914.00 Kg)
        
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
  }, [navigate]);

  // --- Sisa JSX (Render) tidak berubah ---
  // (Tetap sama seperti kode Anda sebelumnya)

  return (
    <div className="content-section">
      <h2>Statistik Harian</h2>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      // Kita cek totalWeight (sekarang 199.00), bukan 0
      : totalWeight === 0 ? ( <p>Belum ada data untuk hari ini.</p> )
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
              {/* Tooltip sekarang akan menampilkan total 199.00 Kg */}
              <Tooltip formatter={(value) => `${value.toFixed(2)} Kg`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabel Preview (Data Mentah) */}
      {/* Tabel ini TETAP menampilkan SEMUA data (914.00 Kg) karena ini adalah "Data Mentah" */}
      {!isLoading && (
        <div style={styles.previewContainer}>
          <h3 style={styles.previewTitle}>Data Mentah</h3>
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

// Objek Styles
const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333' },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

export default StatsHarian;