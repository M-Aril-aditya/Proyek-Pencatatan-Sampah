import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Ganti URL ini sesuai backend Anda jika sudah deploy, atau biarkan localhost
      const response = await axios.post('https://proyek-pencatatan-sampah.vercel.app/api/login', {
        username,
        password
      });

      if (response.data.token) {
        localStorage.setItem('adminToken', response.data.token);
        navigate('/dashboard/harian'); // Arahkan ke dashboard setelah login
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data.message);
      } else {
        setError('Gagal terhubung ke server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Decor (Opsional: Lingkaran hiasan) */}
      <div style={styles.circle1}></div>
      <div style={styles.circle2}></div>

      <div style={styles.loginCard}>
        {/* Header / Logo Area */}
        <div style={styles.header}>
          <h1 style={styles.logoText}>🌱 Green</h1>
          <p style={styles.subtitle}>Monitoring & Pencatatan Sampah</p>
        </div>

        {/* Error Message */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Masukkan username admin"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Masukkan password"
              required
            />
          </div>

          <button 
            type="submit" 
            style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
            disabled={isLoading}
          >
            {isLoading ? 'Memuat...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        <div style={styles.footer}>
          <p>PT. Dexa Medica Palembang &copy; 2025</p>
        </div>
      </div>
    </div>
  );
}

// --- STYLING (CSS-in-JS) ---
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1D5D50 0%, #2E8B57 100%)', // Gradasi Hijau Mewah
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  // Hiasan Latar Belakang (Lingkaran Transparan)
  circle1: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  circle2: {
    position: 'absolute',
    bottom: '-10%',
    right: '-10%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  
  loginCard: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', // Bayangan lembut
    width: '100%',
    maxWidth: '400px',
    zIndex: 2,
    animation: 'fadeInUp 0.8s ease', // Animasi muncul (perlu @keyframes di CSS global jika mau, tapi ini aman)
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logoText: {
    fontSize: '36px',
    color: '#1D5D50',
    margin: '0 0 5px 0',
    fontWeight: '800',
  },
  subtitle: {
    color: '#666',
    margin: 0,
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
  },
  label: {
    fontSize: '14px',
    color: '#333',
    marginBottom: '8px',
    fontWeight: '600',
  },
  input: {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.3s',
    backgroundColor: '#f9f9f9',
  },
  // Efek fokus bisa ditambahkan lewat CSS eksternal, tapi ini basic style-nya
  
  button: {
    padding: '14px',
    backgroundColor: '#1D5D50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px',
    transition: 'background-color 0.3s, transform 0.2s',
    boxShadow: '0 4px 6px rgba(29, 93, 80, 0.2)',
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center',
    marginBottom: '20px',
    border: '1px solid #ef9a9a',
  },
  footer: {
    marginTop: '30px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#aaa',
    borderTop: '1px solid #eee',
    paddingTop: '20px',
  },
};

export default Login;