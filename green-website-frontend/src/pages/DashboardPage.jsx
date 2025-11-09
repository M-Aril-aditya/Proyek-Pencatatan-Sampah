import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom'; // 1. Import Outlet
import Sidebar from '../components/Sidebar'; // Impor Sidebar
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState('');

  // Cek Token saat layout dimuat
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/'); // Jika tidak ada token, tendang ke login
    }
    
    // Set Tanggal
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('id-ID', options));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/');
  };

  return (
    <div className="dashboard-layout">
      {/* 2. Tampilkan Sidebar */}
      <Sidebar /> 
      
      {/* 3. Area Konten Utama */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1>Selamat datang Pengguna!</h1>
            <p className="current-date-text">{currentDate}</p>
          </div>
          <button onClick={handleLogout} className="logout-button-main">Logout</button>
        </header>

        <div className="content-area">
          {/* 4. <Outlet> akan merender halaman anak (Harian, Mingguan, dll) */}
          <Outlet /> 
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;