const db = require('./db');

async function setupDatabase() {
  console.log('Memulai setup database (STRUKTUR DINAMIS)...');
  try {
    await db.query('DROP TABLE IF EXISTS waste_records, admins;');
    console.log('Tabel lama dihapus.');

    const createAdminsTable = `
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      );
    `;
    await db.query(createAdminsTable);
    console.log('Tabel "admins" dibuat.');

    // Tabel BARU untuk data dinamis
    const createWasteRecordsTable = `
      CREATE TABLE IF NOT EXISTS waste_records (
        id SERIAL PRIMARY KEY,
        area_label VARCHAR(255),
        section_title VARCHAR(255),
        item_label VARCHAR(255),
        item_id VARCHAR(100), -- 'kertas_cv', 'kil_terkelola'
        weight_kg DECIMAL(10, 2) DEFAULT 0,
        petugas_name VARCHAR(255),
        recorded_at TIMESTAMP,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(createWasteRecordsTable);
    console.log('Tabel "waste_records" (DINAMIS) berhasil dibuat.');

    console.log('Setup database selesai.');
  } catch (err) {
    console.error('ERROR saat setup database:', err.message);
  }
}
setupDatabase();