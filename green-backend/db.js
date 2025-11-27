const { Pool } = require('pg');
// Konfigurasi Database
const pool = new Pool({
  user: 'postgres',           // Ganti dengan username PostgreSQL Anda
  host: 'localhost',
  database: 'green_db',       // Ganti dengan nama database yang akan kita buat
  password: '12345',    // Ganti dengan password PostgreSQL Anda
  port: 5432,                 // Port default PostgreSQL
});
module.exports = {
  // Fungsi query standar (dipakai di login, stats, dll)
  query: (text, params) => pool.query(text, params),
  
  // Fungsi connect (DIBUTUHKAN untuk Bulk Upload / Transaksi)
  connect: () => pool.connect(), 
};



