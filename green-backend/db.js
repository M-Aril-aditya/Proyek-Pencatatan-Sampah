const { Pool } = require('pg');

// Konfigurasi Database (Otomatis deteksi: Cloud atau Local)
const pool = new Pool({
  // Jika ada DATABASE_URL (dari Cloud), pakai itu. Jika tidak, pakai setting local.
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/green_db',
  
  // Pengaturan SSL (Wajib untuk Cloud Railway/Render)
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(), 
};