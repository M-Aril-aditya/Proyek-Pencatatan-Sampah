import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Halaman-halaman
import App from './App.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx'; // Ini akan jadi Layout

// Halaman-halaman BARU di dalam Dashboard
// (Kita akan buat file-file ini di langkah berikutnya)
import StatsHarian from './pages/StatsHarian.jsx';
import StatsMingguan from './pages/StatsMingguan.jsx';
import StatsBulanan from './pages/StatsBulanan.jsx';
import StatsTahunan from './pages/StatsTahunan.jsx';
import UploadCSV from './pages/UploadCSV.jsx';
import Tentang from './pages/Tentang.jsx'; // Halaman Tentang baru


const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/', 
        element: <LoginPage />,
      },
      {
        path: '/dashboard',
        element: <DashboardPage />, // Ini Layout (Sidebar + Outlet)
        children: [
          // Arahkan /dashboard ke /dashboard/harian
          { index: true, element: <Navigate to="harian" replace /> }, 
          
          // Sub-menu Statistik
          { path: 'harian', element: <StatsHarian /> },
          { path: 'mingguan', element: <StatsMingguan /> },
          { path: 'bulanan', element: <StatsBulanan /> },
          { path: 'tahunan', element: <StatsTahunan /> },
          
          // Halaman Upload & Tentang
          { path: 'upload', element: <UploadCSV /> },
          { path: 'tentang', element: <Tentang /> },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);