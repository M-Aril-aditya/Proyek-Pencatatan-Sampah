const db = require('./db');
const bcrypt = require('bcryptjs');

async function createOrUpdateAdmin() {
  console.log('Memulai pembuatan/pembaruan admin PostgreSQL...');

  const username = 'admin';
  const plainPassword = 'password'; // Password Anda

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(plainPassword, salt);

    // Kueri PostgreSQL menggunakan $1, $2
    const updateQueryText = `
      UPDATE admins SET password_hash = $1 WHERE username = $2
      RETURNING id, username; 
    `;
    const updateValues = [password_hash, username];
    const updateResult = await db.query(updateQueryText, updateValues);

    if (updateResult.rows.length > 0) {
      console.log('Password admin berhasil diperbarui:');
      console.log(updateResult.rows[0]);
    } else {
      console.log(`Username '${username}' tidak ditemukan, mencoba membuat baru...`);
      const insertQueryText = `
        INSERT INTO admins(username, password_hash) VALUES($1, $2)
        RETURNING id, username;
      `;
      const insertValues = [username, password_hash];
      const insertResult = await db.query(insertQueryText, insertValues);
      console.log('Admin baru berhasil dibuat:');
      console.log(insertResult.rows[0]);
    }

  } catch (err) {
    console.error('ERROR saat membuat/memperbarui admin:', err.message);
  }
}

createOrUpdateAdmin();