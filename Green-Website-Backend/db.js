const { Pool } = require('pg');

// Buat 'pool' koneksi. 
// Pool jauh lebih efisien daripada membuat koneksi baru setiap kali ada kueri.
const pool = new Pool({
  user: 'postgres',           // Ganti dengan username PostgreSQL Anda
  host: 'localhost',
  database: 'green_db',       // Ganti dengan nama database yang akan kita buat
  password: '12345',    // Ganti dengan password PostgreSQL Anda
  port: 5432,                 // Port default PostgreSQL
});

// Ekspor fungsi query agar bisa kita gunakan di file lain
module.exports = {
  query: (text, params) => pool.query(text, params),
};