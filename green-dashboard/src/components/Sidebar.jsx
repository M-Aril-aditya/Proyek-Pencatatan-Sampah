import React, { useState } from 'react';
// 1. Gunakan NavLink untuk 'active' style otomatis
import { NavLink } from 'react-router-dom'; 
import './Sidebar.css';
import { FaChartBar, FaUpload, FaLeaf, FaInfoCircle, FaChevronDown, FaChevronRight } from 'react-icons/fa';

function Sidebar() {
  // State untuk mengontrol sub-menu statistik
  const [isStatsOpen, setIsStatsOpen] = useState(true); 

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <FaLeaf size={24} style={{ marginRight: '10px' }} />
        <h2 className="sidebar-title">Green</h2>
      </div>
      <nav className="sidebar-nav">
        
        {/* Tombol Statistik (dengan Sub-menu) */}
        <button 
          className="sidebar-button-parent"
          onClick={() => setIsStatsOpen(!isStatsOpen)}
        >
          <FaChartBar size={18} className="sidebar-icon" />
          Statistik
          {isStatsOpen ? 
            <FaChevronDown size={14} style={{ marginLeft: 'auto' }} /> :
            <FaChevronRight size={14} style={{ marginLeft: 'auto' }} />
          }
        </button>

        {/* Sub-menu (hanya tampil jika isStatsOpen true) */}
        {isStatsOpen && (
          <div className="sidebar-submenu">
            <NavLink 
              to="/dashboard/harian"
              className={({ isActive }) => isActive ? 'sidebar-button active' : 'sidebar-button'}
            >
              Harian
            </NavLink>
            <NavLink 
              to="/dashboard/mingguan"
              className={({ isActive }) => isActive ? 'sidebar-button active' : 'sidebar-button'}
            >
              Mingguan
            </NavLink>
            <NavLink 
              to="/dashboard/bulanan"
              className={({ isActive }) => isActive ? 'sidebar-button active' : 'sidebar-button'}
            >
              Bulanan
            </NavLink>
            <NavLink 
              to="/dashboard/tahunan"
              className={({ isActive }) => isActive ? 'sidebar-button active' : 'sidebar-button'}
            >
              Tahunan
            </NavLink>
          </div>
        )}

        {/* Menu Upload CSV */}
        <NavLink 
          to="/dashboard/upload"
          className="sidebar-button-parent" // Gunakan NavLink sebagai tombol parent
        >
          <FaUpload size={18} className="sidebar-icon" />
          Upload CSV
        </NavLink>

        {/* Menu Tentang */}
        <NavLink 
          to="/dashboard/tentang"
          className="sidebar-button-parent" // Gunakan NavLink sebagai tombol parent
        >
          <FaInfoCircle size={18} className="sidebar-icon" />
          Tentang
        </NavLink>
        
      </nav>
    </div>
  );
}

export default Sidebar;