import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- WARNA: Hijau (Terkelola) & Merah (Tidak Terkelola) ---
const COLORS = ['#4CAF50', '#F44336']; 

function StatsHarian() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);

  // State Tanggal (Default: Hari Ini)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('adminToken');
      // if (!token) { navigate('/'); return; }

      // Kirim parameter tanggal spesifik ke backend
      const params = { date: selectedDate }; 
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        // --- Gunakan localhost:5000 untuk testing ---
        const baseURL = 'http://localhost:5000'; 
        
        const statsRequest = axios.get(`${baseURL}/api/stats`, { params, headers });
        const recordsRequest = axios.get(`${baseURL}/api/records`, { params, headers });

        const [statsResponse, recordsResponse] = await Promise.all([
          statsRequest,
          recordsRequest
        ]);

        const newPieData = statsResponse.data;
        setPieData(newPieData);
        setTableData(recordsResponse.data);

        // Hitung total dari data pie chart
        const newTotal = newPieData.reduce((sum, entry) => sum + entry.value, 0);
        setTotalWeight(newTotal);
        
      } catch (error) {
        console.error('Error fetching daily data:', error);
        setErrorMessage('Gagal mengambil data statistik harian.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate, selectedDate]); 

  return (
    <div className="content-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Statistik Harian</h2>
      </div>

      {/* FILTER TANGGAL */}
      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Pilih Tanggal:</label>
          <input 
            type="date" 
            style={styles.filterSelect}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      : totalWeight === 0 ? ( <div style={{padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px'}}>Tidak ada data untuk tanggal ini.</div> )
      : (
        // --- VISUAL CHART DIPERBAIKI ---
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <h3 style={styles.previewTitle}>Data Mentah ({new Date(selectedDate).toLocaleDateString('id-ID')})</h3>
             <span style={{ fontWeight: 'bold', color: '#1D5D50' }}>Total: {totalWeight.toFixed(2)} Kg</span>
          </div>
          
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, width:'50px', textAlign:'center'}}>No</th>
                  <th style={styles.th}>Waktu</th>
                  <th style={styles.th}>Area</th>
                  <th style={styles.th}>Nama Item</th>
                  <th style={styles.th}>Pengelola</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Bobot (Kg)</th>
                  <th style={styles.th}>Petugas</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? (
                  tableData.map((row, index) => (
                    <tr key={index}>
                      <td style={{...styles.td, textAlign:'center'}}>{index + 1}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style={styles.td}>{row.area_label}</td>
                      <td style={styles.td}>{row.item_label}</td>
                      <td style={styles.td}>{row.pengelola}</td>
                      <td style={styles.td}>{row.status}</td>
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
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
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
  filterContainer: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', flexDirection: 'column' },
  filterLabel: { fontSize: '14px', color: '#333', marginBottom: '4px', fontWeight: '500' },
  filterSelect: { padding: '8px 12px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc' }
};

export default StatsHarian;