import React from 'react';
import { Outlet } from 'react-router-dom';

function App() {
  // Outlet adalah 'placeholder' di mana halaman-halaman kita
  // (seperti Login atau Dashboard) akan ditampilkan oleh router.
  return (
    <div className="app-container">
      <Outlet />
    </div>
  );
}

export default App;