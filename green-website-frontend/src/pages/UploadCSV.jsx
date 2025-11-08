import React, { useState, useRef } from 'react'; // 1. Impor 'useRef'
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function UploadCSV() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewData, setPreviewData] = useState([]);
  
  // 2. Buat ref untuk input file
  const fileInputRef = useRef(null); 

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setUploadMessage('');
    setErrorMessage('');
    setPreviewData([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Silakan pilih file CSV terlebih dahulu.');
      return;
    }

    const formData = new FormData();
    formData.append('csvFile', selectedFile);

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setErrorMessage('Otorisasi gagal. Silakan login kembali.');
        navigate('/');
        return;
      }
      
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setUploadMessage(response.data.message);
      setErrorMessage('');
      setPreviewData(response.data.previewData || []);
      setSelectedFile(null); // Kosongkan state

      // 3. PERBAIKAN: Reset input file secara manual
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (error) {
      console.error('Error saat upload:', error);
      if (error.response) {
        setErrorMessage('Upload Gagal: '.concat(error.response.data.message));
      } else if (error.request) {
        setErrorMessage('Upload Gagal: Tidak bisa terhubung ke server.');
      } else {
        setErrorMessage('Upload Gagal: '.concat(error.message));
      }
      setUploadMessage('');
      setPreviewData([]);
    }
  };

  return (
    <div className="content-section">
      <h2>Upload Laporan CSV</h2>
      <p>Silakan unggah file CSV (format dinamis) yang dihasilkan oleh aplikasi mobile.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input 
          type="file" 
          accept=".csv"
          onChange={handleFileChange} 
          style={styles.fileInput}
          ref={fileInputRef} // 4. Hubungkan ref ke input
          // key={...} (Properti 'key' yang lama dihapus)
        />
        <button type="submit" style={styles.uploadButton}>Upload File</button>
      </form>

      {/* Pesan Status */}
      {uploadMessage && <p style={styles.successMessage}>{uploadMessage}</p>}
      {errorMessage && <p style={styles.errorMessage}>{errorMessage}</p>}

      {/* Tabel Preview */}
      {previewData.length > 0 && (
        <div style={styles.previewContainer}>
          <h3 style={styles.previewTitle}>Data yang Baru Saja Di-upload</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {Object.keys(previewData[0]).map(key => (
                    <th key={key} style={styles.th}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, i) => (
                      <td key={i} style={styles.td}>{value}</td>
                    ))}
                  </tr>
                ))}
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
  form: { marginTop: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eee' },
  fileInput: { marginBottom: '1rem', display: 'block' },
  uploadButton: { padding: '0.75rem 1.5rem', backgroundColor: '#1D5D50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' },
  successMessage: { marginTop: '1rem', color: 'green', fontWeight: 'bold' },
  errorMessage: { marginTop: '1Mrem', color: 'red', fontWeight: 'bold' },
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333' },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  tr: { /* (nth-child(even) memerlukan file CSS) */ },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

export default UploadCSV;