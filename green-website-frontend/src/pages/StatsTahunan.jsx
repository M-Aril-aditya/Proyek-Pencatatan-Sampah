import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// 1. HAPUS 'import * as XLSX from 'xlsx';' - Ini adalah sumber error

const COLORS = ['#1D5D50', '#C0392B']; // Hijau (Terkelola), Merah (Tidak Terkelola)

function StatsTahunan() {
  const navigate = useNavigate();
  const [pieData, setPieData] = useState([]);
  const [tableData, setTableData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  // 2. State baru untuk melacak proses ekspor
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/'); return; }

      const params = { range: 'yearly' }; 
      
      try {
        const recordsResponse = await axios.get('http://localhost:5000/api/records', { 
          params, headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const rawData = recordsResponse.data;
        
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

        const newPieData = [
          { name: 'Terkelola', value: finalTerkelola },       
          { name: 'Tidak Terkelola', value: finalTidakTerkelola }
        ];
        const newTotal = finalTerkelola + finalTidakTerkelola;

        setPieData(newPieData);
        setTotalWeight(newTotal); 
        setTableData(rawData); 
        
      } catch (error) {
        console.error('Error fetching yearly data:', error);
        if (error.response) {
          console.error('Data error:', error.response.data);
          console.error('Status error:', error.response.status);
        }
        setErrorMessage('Gagal mengambil data statistik tahunan.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // 3. Fungsi baru untuk memuat script dari CDN
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      // Cek jika script sudah ada
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

  // 4. Ubah handleExport menjadi async dan gunakan CDN
  const handleExport = async () => {
    setIsExporting(true); // Mulai loading
    try {
      // Muat script XLSX dari CDN
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

      // Cek apakah library berhasil dimuat ke window
      if (typeof window.XLSX === 'undefined') {
        console.error('XLSX library not loaded.');
        setErrorMessage('Gagal memuat library ekspor. Coba lagi.');
        setIsExporting(false);
        return;
      }

      // Format data (sama seperti sebelumnya)
      const dataToExport = tableData.map(row => ({
        'Area': row.area_label,
        'Seksi': row.section_title,
        'Nama Item': row.item_label,
        'Bobot (Kg)': parseFloat(row.weight_kg).toFixed(2),
        'Petugas': row.petugas_name,
        'Waktu Catat': new Date(row.recorded_at).toLocaleString('id-ID')
      }));

      // Gunakan window.XLSX (bukan XLSX dari import)
      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Data Tahunan');
      window.XLSX.writeFile(wb, 'Laporan_Tahunan.xlsx'); // Ganti nama file

    } catch (error) {
      console.error('Error exporting data:', error);
      setErrorMessage('Gagal mengekspor data.');
    } finally {
      setIsExporting(false); // Selesai loading
    }
  };


  return (
    <div className="content-section">
      <h2>Statistik Tahunan (% Terkelola)</h2>
      
      {/* ... (Kode Pie Chart tetap sama) ... */}
      {isLoading ? ( <p>Memuat data...</p> )
      : errorMessage ? ( <p style={{ color: 'red' }}>{errorMessage}</p> )
      : totalWeight === 0 ? ( <p>Belum ada data summary (TERKELOLA/TIDAK TERKELOLA) untuk tahun ini.</p> )
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
            {/* 5. Ubah Tombol untuk menangani state loading/disabled */}
            <button onClick={handleExport} style={styles.exportButton} disabled={isExporting}>
              {isExporting ? 'Mengekspor...' : 'Ekspor ke XLSX'}
            </button>
          </div>
          <div style={styles.tableWrapper}>
            {/* ... (Isi tabel tidak berubah) ... */}
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

// 5. Tambahkan style baru untuk tombol dan header tabel
const styles = {
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333', margin: 0 }, 
  tableHeaderContainer: { 
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem' 
  },
  exportButton: { 
    backgroundColor: '#1D5D50',
    color: 'white',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

export default StatsTahunan;