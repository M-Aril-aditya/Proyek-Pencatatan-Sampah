import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom'; // Import useNavigate


function StatsContent() {
  const navigate = useNavigate(); // Gunakan useNavigate
  const [statsData, setStatsData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState('today');
  const [errorMessage, setErrorMessage] = useState('');


  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      setErrorMessage('');
      setStatsData([]);
       try {
        const token = localStorage.getItem('adminToken');
        if (!token) { navigate('/'); return; } // Arahkan ke login jika token tidak ada
        const response = await axios.get(`https://proyek-pencatatan-sampah.vercel.app/api/stats?range=${selectedRange}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setStatsData(response.data);
        setStatsLoading(false);
      } catch (error) {
        console.error(`Error fetching ${selectedRange} stats:`, error);
        setErrorMessage(`Gagal mengambil data statistik ${selectedRange}.`);
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [selectedRange, navigate]); // Tambahkan navigate ke dependencies

  const changeRange = (range) => { setSelectedRange(range); };
  const getRangeTitle = (range) => { /* ... (fungsi sama seperti sebelumnya) */ };
  const chartData = statsData.map(item => ({ name: item.waste_category, kg: parseFloat(item.total_weight) }));

  return (
    <div className="content-section">
      <div style={styles.statsHeader}>
        <h2>Statistik Sampah {getRangeTitle(selectedRange)}</h2>
        <div style={styles.filterButtons}>
           <button onClick={() => changeRange('today')} style={selectedRange === 'today' ? styles.activeButton : styles.inactiveButton}>Hari Ini</button>
           <button onClick={() => changeRange('week')} style={selectedRange === 'week' ? styles.activeButton : styles.inactiveButton}>Minggu Ini</button>
           <button onClick={() => changeRange('month')} style={selectedRange === 'month' ? styles.activeButton : styles.inactiveButton}>Bulan Ini</button>
           <button onClick={() => changeRange('year')} style={selectedRange === 'year' ? styles.activeButton : styles.inactiveButton}>Tahun Ini</button>
        </div>
      </div>
      {/* ... Tampilan statistik (kotak & grafik) ... */}
       <div style={styles.chartContainer}>
            {statsLoading ? ( <p>Memuat data grafik...</p> )
             : errorMessage ? ( <p style={{ color: 'red' }}></p> )
             : statsData.length > 0 ? (
             <ResponsiveContainer width="100%" height={300}>
             <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" />
             <XAxis dataKey="name" />
             <YAxis label={{ value: 'Kg', angle: -90, position: 'insideLeft' }} />
             <Tooltip />
             <Legend />
             <Bar dataKey="kg" fill="#1D5D50" name="Total Berat (Kg)" />
             </BarChart>
             </ResponsiveContainer>
             ) : null }
       </div>
    </div>
  );
}
// Tambahkan style yang relevan di sini atau impor dari file CSS
const styles = {
    // ... (copy style relevan dari DashboardPage.jsx lama)
     statsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
     filterButtons: { display: 'flex', gap: '0.5rem' },
     activeButton: { padding: '0.5rem 1rem', backgroundColor: '#1D5D50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
     inactiveButton: { padding: '0.5rem 1rem', backgroundColor: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
     chartContainer: { marginTop: '2rem', height: '300px', width: '100%' },
};


export default StatsContent;