const { Pool } = require('pg');

// Konfigurasi Database Lokal (Laptop)
const pool = new Pool({
  user: 'postgres',        // Username default pgAdmin
  host: 'localhost',       // Server lokal
  database: 'green_db',    // Nama database lokal Anda
  password: '12345',       // Password pgAdmin laptop Anda
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(), 
};