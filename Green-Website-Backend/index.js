const express = require('express');
const cors = require('cors');
const db = require('./db'); // Koneksi PostgreSQL
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const excel = require('exceljs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'rahasia-anda-yang-sangat-sulit-ditebak';

// Konfigurasi Multer
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){ fs.mkdirSync(uploadsDir); }
const upload = multer({ dest: uploadsDir });

// --- KONFIGURASI MIDDLEWARE ---
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: "GET,POST,DELETE",
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- RUTE API ---

// Rute Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userQuery = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Admin tidak ditemukan' });
    }
    const admin = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password salah' });
    }
    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login berhasil', token });
  } catch (err) {
    console.error('Error saat login:', err.message);
    res.status(500).json({ message: 'Server error saat login.' });
  }
});

// Rute Upload (Struktur CSV DINAMIS)
app.post('/api/upload', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File tidak ditemukan.' });
  }

  const filePath = req.file.path;
  const results = [];
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      if (results.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: 'File CSV kosong atau format salah.' });
      }
      
      try {
        await db.query('BEGIN'); // Mulai transaksi

        for (const row of results) {
          let dateTimeString = row['Waktu Catat']?.replace(/"/g, '') || '';
          dateTimeString = dateTimeString.replace('.', ':');
          const parsableDateString = dateTimeString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'); 
          let recordedAt = new Date(parsableDateString);
          
          if (isNaN(recordedAt.getTime())) {
             const isoDate = new Date(dateTimeString);
             if (isNaN(isoDate.getTime())) {
                throw new Error(`Format tanggal tidak valid: ${row['Waktu Catat']}`);
             }
             recordedAt = isoDate;
          }
          
          const queryText = `
            INSERT INTO waste_records 
              (area_label, section_title, item_label, item_id, weight_kg, petugas_name, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          const values = [
            row['Area'],
            row['Section'],
            row['Nama Item'],
            row['ID Item'],
            parseFloat(row['Bobot (Kg)']) || 0,
            row['Petugas'],
            recordedAt
          ];
          
          await db.query(queryText, values);
        }
        
        await db.query('COMMIT');
        console.log('Data (DINAMIS) berhasil disimpan ke database PostgreSQL.');
        
        res.json({ 
          message: `File CSV berhasil diproses! ${results.length} baris data disimpan.`,
          previewData: results 
        });

      } catch (dbError) {
        await db.query('ROLLBACK');
        console.error('Error saat menyimpan ke DB:', dbError.message);
        res.status(500).json({ message: `Gagal menyimpan data ke database. Error: ${dbError.message}` });
      
      } finally {
        fs.unlinkSync(filePath);
      }
    });
});

// === FUNGSI HELPER TANGGAL (FIX TIMEZONE) ===
function getSQLDateCondition(range, year, month, week) {
  let dateCondition = '';
  const jsDate = new Date(); // Gunakan jam server Node.js
  
  const targetYear = year ? parseInt(year) : jsDate.getFullYear();
  const targetMonth = month ? parseInt(month) : jsDate.getMonth() + 1; // 1-12
  const targetWeek = week ? parseInt(week) : 1;

  // --- FIX TIMEZONE BUG ---
  // Helper untuk format YYYY-MM-DD LOKAL (BUKAN UTC)
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // ------------------------
  
  switch (range) {
    case 'weekly':
      let startDateW, endDateW;
      if (targetWeek === 1) { startDateW = `'${targetYear}-${targetMonth}-01'`; endDateW = `'${targetYear}-${targetMonth}-07'`; }
      else if (targetWeek === 2) { startDateW = `'${targetYear}-${targetMonth}-08'`; endDateW = `'${targetYear}-${targetMonth}-14'`; }
      else if (targetWeek === 3) { startDateW = `'${targetYear}-${targetMonth}-15'`; endDateW = `'${targetYear}-${targetMonth}-21'`; }
      else { // week 4
        startDateW = `'${targetYear}-${targetMonth}-22'`;
        // Akhir bulan (PostgreSQL)
        const lastDay = `(DATE_TRUNC('MONTH', ${startDateW}::DATE) + INTERVAL '1 MONTH' - INTERVAL '1 DAY')::DATE`;
        endDateW = lastDay;
        dateCondition = `DATE(recorded_at) BETWEEN ${startDateW} AND ${endDateW}`;
      }
      if (targetWeek <= 3) {
         dateCondition = `DATE(recorded_at) BETWEEN ${startDateW} AND ${endDateW}`;
      }
      break;

    case 'monthly':
      dateCondition = `EXTRACT(MONTH FROM recorded_at) = ${targetMonth} AND EXTRACT(YEAR FROM recorded_at) = ${targetYear}`;
      break;
      
    case 'yearly':
      dateCondition = `EXTRACT(YEAR FROM recorded_at) = ${targetYear}`;
      break;
      
    default: // 'daily'
      // Gunakan helper format tanggal LOKAL yang baru
      const today = formatDate(jsDate); 
      dateCondition = `DATE(recorded_at) = '${today}'`;
  }
  return dateCondition;
}
// ===========================================

// === RUTE STATISTIK (DENGAN KUERI DIPERBAIKI) ===
// === RUTE STATISTIK (DENGAN KUERI DIPERBAIKI) ===
// === RUTE STATISTIK (DENGAN KUERI DIPERBAIKI) ===
app.get('/api/stats', async (req, res) => {
  const { range, year, month, week } = req.query;
  
  try {
    // Panggil fungsi helper tanggal Anda (ini sudah benar)
    const dateCondition = getSQLDateCondition(range, year, month, week);

    // --- KUERI SQL DIPERBAIKI (INI ADALAH SOLUSINYA) ---
    // Logika baru: Hitung 'Tidak Terkelola' secara spesifik,
    // dan 'Terkelola' adalah SEMUA SISANYA.
    const query = `
      SELECT 
        COALESCE(SUM(CASE 
                     WHEN item_id NOT LIKE '%_tidak_terkelola' THEN weight_kg 
                     ELSE 0 
                   END), 0) as total_terkelola,
        COALESCE(SUM(CASE 
                     WHEN item_id LIKE '%_tidak_terkelola' THEN weight_kg 
                     ELSE 0 
                   END), 0) as total_tidak_terkelola
      FROM 
        waste_records 
      WHERE 
        ${dateCondition};
    `;
    // ------------------------------------
    
    const statsQuery = await db.query(query);
    const data = statsQuery.rows[0];

    // Cek terminal backend Anda untuk log ini
    console.log(`Statistik (${range}) DIJALANKAN:`, data); 

    const pieData = [
      { name: 'Terkelola', value: parseFloat(data.total_terkelola) },
      { name: 'Tidak Terkelola', value: parseFloat(data.total_tidak_terkelola) }
    ];
    
    res.json(pieData);

  } catch (err) {
    console.error(`Error saat mengambil statistik:`, err.message);
    res.status(500).json({ message: 'Server error saat mengambil statistik.' });
  }
});

// === RUTE DATA MENTAH (DENGAN FIX TANGGAL) ===
app.get('/api/records', async (req, res) => {
  const { range, year, month, week } = req.query;

  try {
    const dateCondition = getSQLDateCondition(range, year, month, week);

    const query = `
      SELECT 
        area_label, 
        section_title, 
        item_label, 
        weight_kg, 
        petugas_name, 
        recorded_at
      FROM 
        waste_records 
      WHERE 
        ${dateCondition}
      ORDER BY 
        recorded_at DESC;
    `;
    
    const recordsQuery = await db.query(query);
    res.json(recordsQuery.rows);

  } catch (err) {
    console.error(`Error saat mengambil data records:`, err.message);
    res.status(500).json({ message: 'Server error saat mengambil data.' });
  }
});

// Rute Hapus Data
app.delete('/api/clear-data', async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE waste_records RESTART IDENTITY;');
    console.log('Semua data waste_records berhasil dihapus.');
    res.status(200).json({ message: 'Semua data sampah berhasil dihapus.' });
  } catch (err) {
    console.error('Error saat menghapus data:', err.message);
    res.status(500).json({ message: 'Server error saat menghapus data.' });
  }
});

// Rute Ekspor Excel
app.get('/api/export/monthly', async (req, res) => {
    const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        const { rows } = await db.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(MONTH FROM recorded_at) = $1 AND EXTRACT(YEAR FROM recorded_at) = $2
             ORDER BY recorded_at ASC`,
            [targetMonth, targetYear]
        );

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Bulan ${targetMonth}-${targetYear}`);

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 5 },
            { header: 'Area', key: 'area_label', width: 30 },
            { header: 'Seksi', key: 'section_title', width: 30 },
            { header: 'Nama Item', key: 'item_label', width: 30 },
            { header: 'Bobot (Kg)', key: 'weight_kg', width: 15, style: { numFmt: '0.00' } },
            { header: 'Petugas', key: 'petugas_name', width: 20 },
            { header: 'Waktu Catat', key: 'recorded_at', width: 25, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
        ];
        
        const dataForExcel = rows.map(row => ({
            ...row,
            weight_kg: parseFloat(row.weight_kg),
        }));
        worksheet.addRows(dataForExcel);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + `laporan_bulanan_${targetMonth}-${targetYear}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error saat ekspor Excel:', err.message);
        res.status(500).json({ message: 'Gagal membuat file Excel.' });
    }
});


// --- Server Listen ---
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});