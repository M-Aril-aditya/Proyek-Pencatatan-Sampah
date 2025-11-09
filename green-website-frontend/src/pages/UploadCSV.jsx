import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function UploadCSV() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewData, setPreviewData] = useState([]);
  
  // (BARU) State untuk styling drag-over
  const [isDragging, setIsDragging] = useState(false); 
  
  const fileInputRef = useRef(null); 

  // (DIUBAH) handleFileChange sekarang jadi pusat
  const handleFileSelect = (file) => {
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setUploadMessage('');
      setErrorMessage('');
      setPreviewData([]);
    } else {
      setErrorMessage('Hanya file .csv yang diizinkan.');
      setSelectedFile(null);
    }
  };
  
  // (BARU) Handler untuk klik manual
  const handleDropzoneClick = () => {
    fileInputRef.current.click();
  };
  
  // (BARU) Handler untuk event drag
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Silakan pilih file CSV terlebih dahulu.');
      return;
    }
    // ... (Logika handleSubmit Anda sudah benar, TIDAK PERLU DIUBAH) ...
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
  
  // (BARU) Fungsi untuk menghapus file yang dipilih
  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="content-section">
      <h2>Upload Laporan CSV</h2>
      <p>Drag file CSV Anda ke kotak di bawah, atau klik untuk memilih file.</p>

      {/* (PERUBAHAN BESAR) - Tampilan Form dan Dropzone */}
      <form onSubmit={handleSubmit} style={styles.form}>
        
        {/* Dropzone */}
        <div 
          style={{ ...styles.dropzone, ...(isDragging ? styles.dropzoneActive : {}) }}
          onClick={handleDropzoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Input file asli kita sembunyikan */}
          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => handleFileSelect(e.target.files[0])} 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
          />
          
          {/* Konten di dalam Dropzone */}
          {selectedFile ? (
            <div style={styles.fileInfo}>
              <span style={styles.fileName}>File Siap: {selectedFile.name}</span>
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation(); // Hentikan klik agar tidak trigger dropzone
                  clearSelectedFile();
                }} 
                style={styles.clearButton}
              >
                Batal
              </button>
            </div>
          ) : (
            <p style={styles.dropzoneText}>
              Drag & Drop file di sini, atau klik untuk memilih
            </p>
          )}
        </div>

        <button 
          type="submit" 
          style={{...styles.uploadButton, ...(!selectedFile ? styles.buttonDisabled : {})}} 
          disabled={!selectedFile}
        >
          Upload File
        </button>
      </form>
      {/* (AKHIR PERUBAHAN) */}


      {/* Pesan Status (Tidak Berubah) */}
      {uploadMessage && <p style={styles.successMessage}>{uploadMessage}</p>}
      {errorMessage && <p style={styles.errorMessage}>{errorMessage}</p>}

      {/* Tabel Preview (Tidak Berubah) */}
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

// (PERUBAHAN) Objek Styles
const styles = {
  form: { marginTop: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eee' },
  
  // Style baru untuk Dropzone
  dropzone: {
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: '#f9f9f9',
    transition: 'background-color 0.2s, border-color 0.2s',
    marginBottom: '1rem',
  },
  dropzoneActive: {
    backgroundColor: '#e6f7ff',
    borderColor: '#1D5D50',
  },
  dropzoneText: {
    color: '#777',
    margin: 0,
    fontSize: '1rem',
  },
  fileInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '1rem',
    color: '#333',
    fontWeight: '500',
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clearButton: {
    padding: '4px 8px',
    backgroundColor: '#C0392B',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginLeft: '1rem',
  },

  // Style Tombol Upload yang diubah
  uploadButton: { 
    padding: '0.75rem 1.5rem', 
    backgroundColor: '#1D5D50', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontSize: '1rem',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#aaa',
    cursor: 'not-allowed',
  },

  // Style lama (tidak berubah)
  successMessage: { marginTop: '1rem', color: 'green', fontWeight: 'bold' },
  errorMessage: { marginTop: '1rem', color: 'red', fontWeight: 'bold' },
  previewContainer: { marginTop: '2rem' },
  previewTitle: { color: '#333' },
  tableWrapper: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', borderBottom: '2px solid #1D5D50', backgroundColor: '#f9f9f9', textAlign: 'left', textTransform: 'capitalize' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
};

export default UploadCSV;