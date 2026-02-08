import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- WARNA: Hijau (Terkelola) & Merah (Tidak Terkelola) ---
const COLORS = ['#27ae60', '#F44336']; 

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

const weekOptions = [
  { value: 1, label: 'Minggu 1 (Tgl 1-7)' },
  { value: 2, label: 'Minggu 2 (Tgl 8-14)' },
  { value: 3, label: 'Minggu 3 (Tgl 15-21)' },
  { value: 4, label: 'Minggu 4 (Tgl 22-Akhir)' },
];

function StatsMingguan() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);

  // State untuk Filter
  const jsDate = new Date();
  const dayOfMonth = jsDate.getDate();
  let currentWeekOfMonth = 1;
  if (dayOfMonth >= 8 && dayOfMonth <= 14) currentWeekOfMonth = 2;
  else if (dayOfMonth >= 15 && dayOfMonth <= 21) currentWeekOfMonth = 3;
  else if (dayOfMonth >= 22) currentWeekOfMonth = 4;

  const [selectedYear, setSelectedYear] = useState(jsDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(jsDate.getMonth() + 1); 
  const [selectedWeek, setSelectedWeek] = useState(currentWeekOfMonth);

  // --- FUNGSI FETCH DATA ---
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    const token = localStorage.getItem('adminToken');
    
    const params = { 
      range: 'weekly',
      year: selectedYear,
      month: selectedMonth,
      week: selectedWeek
    }; 
    const headers = { 'Authorization': `Bearer ${token}` };
    
    try {
      const baseURL = 'proyek-pencatatan-sampah.vercel.app'; // Sesuaikan URL Backend
      
      const statsRequest = axios.get(`${baseURL}/api/stats`, { params, headers });
      const recordsRequest = axios.get(`${baseURL}/api/records`, { params, headers });

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
      console.error('Error fetching weekly data:', error);
      setErrorMessage('Gagal mengambil data statistik mingguan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate, selectedYear, selectedMonth, selectedWeek]); 

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
      fetchData(); // Refresh Data

    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Gagal menghapus data.");
    }
  };

  return (
    <div className="content-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Statistik Mingguan</h2>
      </div>

      {/* FILTER */}
      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Tahun:</label>
          <select style={styles.filterSelect} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {generateYearOptions().map(year => ( <option key={year} value={year}>{year}</option> ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Bulan:</label>
          <select style={styles.filterSelect} value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {monthOptions.map(month => ( <option key={month.value} value={month.value}>{month.label}</option> ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Minggu:</label>
          <select style={styles.filterSelect} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
            {weekOptions.map(week => ( <option key={week.value} value={week.value}>{week.label}</option> ))}
          </select>
        </div>
      </div>
      
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      : totalWeight === 0 ? ( <div style={{padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px'}}>Belum ada data untuk periode ini.</div> )
      : (
        <>
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

        {/* TABLE DATA */}
        <div style={styles.previewContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={styles.previewTitle}>Data Mentah (Minggu Ini)</h3>
             <span style={{ fontWeight: 'bold', color: '#1D5D50' }}>Total: {totalWeight.toFixed(2)} Kg</span>
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
                {tableData.length > 0 ? (
                  tableData.map((row, index) => (
                    <tr key={index}>
                      <td style={{...styles.td, textAlign:'center'}}>{index + 1}</td>
                      <td style={styles.td}>{new Date(row.recorded_at).toLocaleDateString('id-ID')}</td>
                      <td style={styles.td}>{row.area_label}</td>
                      <td style={styles.td}>{row.item_label}</td>
                      {/* <td style={styles.td}>{row.pengelola}</td> */}
                      <td style={styles.td}>{row.status}</td>
                      <td style={styles.td}>{parseFloat(row.weight_kg).toFixed(2)}</td>
                      <td style={styles.td}>{row.petugas_name}</td>
                      
                      {/* TOMBOL HAPUS */}
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
                    <td colSpan="8" style={{ ...styles.td, textAlign: 'center' }}>Tidak ada data mentah.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333', marginBottom: '10px' },
  tableWrapper: { maxHeight: '500px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
  filterContainer: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', flexDirection: 'column' },
  filterLabel: { fontSize: '14px', color: '#333', marginBottom: '4px', fontWeight: '500' },
  filterSelect: { padding: '8px 12px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '150px' }
};

export default StatsMingguan;