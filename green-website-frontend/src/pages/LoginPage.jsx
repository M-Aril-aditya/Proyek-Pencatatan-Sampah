import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css'; // Pastikan file CSS ini ada
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah form refresh halaman
    
    try {
      // Kirim data login ke backend
      const response = await axios.post('http://localhost:5000/api/login', {
        username: username,
        password: password
      });
      
      // Ambil token dari respons
      const { token } = response.data;

      // Simpan token ke localStorage
      localStorage.setItem('adminToken', token);
      
      // Pindahkan pengguna ke dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Error saat login:', error);
      // Tampilkan pesan error sederhana
      if (error.response) {
        alert('Login Gagal: ' + error.response.data.message);
      } else if (error.request) {
        alert('Login Gagal: Tidak bisa terhubung ke server.');
      } else {
        alert('Login Gagal: Terjadi kesalahan.');
      }
    }
  };

  return (
    <div className="login-wrapper">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Silahkan Melakukan Login!</h2>
        <div className="input-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button">Masuk</button>
      </form>
    </div>
  );
}

export default LoginPage;