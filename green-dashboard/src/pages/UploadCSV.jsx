import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function UploadCSV() {
  const navigate = useNavigate();
  
  // State File & Pesan
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [uploadMessage, setUploadMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // State Input Tanggal Manual
  const [manualDate, setManualDate] = useState(''); 
  
  const fileInputRef = useRef(null); 

  // Handler Pilih File
  const handleFileSelect = (newFiles) => {
    const validFiles = [];
    let errorMsg = '';

    Array.from(newFiles).forEach(file => {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const isDuplicate = selectedFiles.some(f => f.name === file.name);
        if (!isDuplicate) {
            validFiles.push(file);
        }
      } else {
        errorMsg = 'Hanya file .csv yang diizinkan.';
      }
    });

    if (errorMsg) setErrorMessage(errorMsg);
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setUploadMessage('');
  };
  
  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Drag & Drop Handlers
  const handleDropzoneClick = () => fileInputRef.current.click();
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Submit Upload
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMessage('Silakan pilih minimal satu file CSV.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    
    // Append File
    selectedFiles.forEach(file => {
        formData.append('csvFiles', file);
    });

    // Append Tanggal (Jika ada)
    if (manualDate) {
        formData.append('date', manualDate);
    }

    try {
      const token = localStorage.getItem('adminToken');
      // if (!token) { ... } // Logic auth opsional

      
      const baseURL = 'https://proyek-pencatatan-sampah.vercel.app'; 
      
      const response = await axios.post(`${baseURL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setUploadMessage(response.data.message);
      setErrorMessage('');
      setSelectedFiles([]); 
      setManualDate(''); // Reset tanggal setelah sukses
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (error) {
      console.error('Error saat upload:', error);
      if (error.response) {
        setErrorMessage('Upload Gagal: '.concat(error.response.data.message));
      } else {
        setErrorMessage('Upload Gagal: Terjadi kesalahan jaringan.');
      }
      setUploadMessage('');
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="content-section">
      <h2>Upload Laporan CSV</h2>
      <p>Anda dapat mengunggah banyak file sekaligus. Drag & drop file di sini.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        
        {/* --- INPUT TANGGAL MANUAL --- */}
        <div style={styles.dateInputContainer}>
            <label style={styles.dateLabel}>Tanggal Data (Opsional):</label>
            <input 
                type="date" 
                style={styles.dateInput}
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
            />
            <p style={styles.dateHint}>
                *Jika dikosongkan, data akan tercatat sebagai hari ini ({new Date().toLocaleDateString('id-ID')}).
            </p>
        </div>

        {/* DROPZONE */}
        <div 
          style={{ ...styles.dropzone, ...(isDragging ? styles.dropzoneActive : {}) }}
          onClick={handleDropzoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            accept=".csv"
            multiple 
            onChange={(e) => handleFileSelect(e.target.files)} 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
          />
          <p style={styles.dropzoneText}>Klik atau Drag banyak file CSV ke sini</p>
        </div>

        {/* LIST FILE */}
        {selectedFiles.length > 0 && (
            <div style={styles.fileListContainer}>
                <h4 style={{marginTop: 0, marginBottom: '10px', color: '#333'}}>File yang akan diupload:</h4>
                {selectedFiles.map((file, index) => (
                    <div key={index} style={styles.fileItem}>
                        <span style={styles.fileName}>📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                        <button type="button" onClick={() => handleRemoveFile(index)} style={styles.deleteButton} title="Hapus">✕</button>
                    </div>
                ))}
            </div>
        )}

        <button 
          type="submit" 
          style={{...styles.uploadButton, ...((selectedFiles.length === 0 || isUploading) ? styles.buttonDisabled : {})}} 
          disabled={selectedFiles.length === 0 || isUploading}
        >
          {isUploading ? 'Sedang Mengunggah...' : `Upload ${selectedFiles.length} File`}
        </button>
      </form>

      {uploadMessage && <div style={styles.successBox}>{uploadMessage}</div>}
      {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}
    </div>
  );
}

const styles = {
  form: { marginTop: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eee' },
  
  // Style Date Input
  dateInputContainer: { marginBottom: '1.5rem' },
  dateLabel: { display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#333' },
  dateInput: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', width: '100%', maxWidth: '300px' },
  dateHint: { fontSize: '12px', color: '#777', marginTop: '5px' },

  dropzone: {
    border: '2px dashed #ccc', borderRadius: '8px', padding: '2rem', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f9f9f9', transition: 'all 0.2s', marginBottom: '1rem',
  },
  dropzoneActive: { backgroundColor: '#e6f7ff', borderColor: '#1D5D50' },
  dropzoneText: { color: '#777', fontSize: '1rem' },
  
  fileListContainer: { backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
  fileName: { color: '#555' },
  deleteButton: { background: 'none', border: 'none', color: '#C0392B', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', padding: '0 5px' },

  uploadButton: { padding: '0.75rem 1.5rem', backgroundColor: '#1D5D50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', width: '100%' },
  buttonDisabled: { backgroundColor: '#aaa', cursor: 'not-allowed' },
  
  successBox: { marginTop: '1rem', padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '5px' },
  errorBox: { marginTop: '1rem', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '5px' },
};

export default UploadCSV;