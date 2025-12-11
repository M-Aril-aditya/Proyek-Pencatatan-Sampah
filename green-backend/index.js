require('dotenv').config(); // Untuk testing lokal
const express = require('express');
const cors = require('cors'); // Wajib ada untuk izin akses browser
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const excel = require('exceljs');
const { Readable } = require('stream'); // Wajib untuk Vercel (baca buffer)

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. KONEKSI DATABASE (NEON / CLOUD) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Wajib untuk Neon Database
});

// --- 2. CONFIG MULTER (MEMORY STORAGE) ---
// Vercel tidak punya disk fisik, file disimpan di RAM sementara
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const PdfPrinter = require('pdfmake');
const path = require('path');
// --- 3. MIDDLEWARE (PENTING) ---
// Gunakan CORS paling sederhana agar semua device (Laptop/HP) diizinkan masuk
app.use(cors()); 
app.use(express.json());

// --- 4. ROUTES UTAMA ---

// Cek Status Server
app.get('/', (req, res) => {
    res.send('Green Backend is Running on Vercel!');
});

// --- A. LOGIN ADMIN (WEB DASHBOARD) ---
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userQuery = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    
    if (userQuery.rows.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan' });
    
    const admin = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    
    if (!isMatch) return res.status(401).json({ message: 'Password salah' });
    
    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET || 'rahasia', { expiresIn: '1d' });
    res.json({ message: 'Login berhasil', token });
  } catch (err) {
    console.error('Error login:', err.message);
    res.status(500).json({ message: 'Server error saat login.' });
  }
});

// --- B. LOGIN PETUGAS (MOBILE APP) ---
app.post('/api/login-petugas', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM petugas WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Petugas tidak ditemukan' });

        const petugas = result.rows[0];
        // Cek password (Plain text sesuai request Anda untuk kemudahan)
        if (password !== petugas.password) {
            return res.status(401).json({ message: 'Password salah' });
        }

        res.json({ message: 'Login Berhasil', role: 'petugas', username: petugas.username });
    } catch (err) {
        console.error('Error login petugas:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- C. MANAJEMEN PETUGAS (CRUD) ---

// 1. Ambil Daftar Petugas
app.get('/api/petugas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username FROM petugas ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Gagal mengambil data petugas' });
    }
});

// 2. Tambah Petugas Baru
app.post('/api/petugas', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Cek username kembar
        const cek = await pool.query('SELECT * FROM petugas WHERE username = $1', [username]);
        if (cek.rows.length > 0) return res.status(400).json({ message: 'Username sudah ada!' });

        const newUser = await pool.query(
            'INSERT INTO petugas (username, password) VALUES ($1, $2) RETURNING *',
            [username, password]
        );
        res.json({ message: 'Petugas berhasil dibuat', petugas: newUser.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Gagal menambah petugas' });
    }
});

// 3. Hapus Petugas
app.delete('/api/petugas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM petugas WHERE id = $1', [req.params.id]);
        res.json({ message: 'Petugas dihapus' });
    } catch (err) {
        res.status(500).json({ message: 'Gagal menghapus' });
    }
});


// --- D. UPLOAD CSV (VERCEL STREAM MODE) ---
// --- D. UPLOAD CSV (DENGAN FITUR BACKDATING / WAKTU MUNDUR) ---
app.post('/api/upload', upload.array('csvFiles'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'Tidak ada file.' });

  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      const rowData = [];
      
      // Baca dari BUFFER (RAM)
      Readable.from(file.buffer)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') // Fix BOM & Spasi
        }))
        .on('data', (data) => rowData.push(data))
        .on('error', (err) => reject(err))
        .on('end', async () => {
            if (rowData.length === 0) return resolve({ status: 'error', file: file.originalname, reason: 'File kosong' });
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const row of rowData) {
                    
                    // --- LOGIKA WAKTU (BARU) ---
                    let recordedAt = new Date(); // Default: Waktu Detik Ini (Jika kolom Tanggal kosong)

                    // Cek apakah di CSV ada kolom 'Tanggal', 'Waktu', atau 'Date'
                    const csvDateString = row['Tanggal'] || row['Waktu'] || row['Date'];

                    if (csvDateString) {
                        const parsedDate = new Date(csvDateString);
                        // Cek apakah format tanggal valid?
                        if (!isNaN(parsedDate.getTime())) {
                            recordedAt = parsedDate; // GUNAKAN WAKTU DARI CSV
                        }
                    }
                    // ---------------------------

                    const queryText = `
                        INSERT INTO waste_records 
                        (area_label, item_label, pengelola, status, weight_kg, petugas_name, recorded_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `;
                    const values = [
                        row['Area'], row['Nama Item'], row['Pengelola'],
                        row['Status'], parseFloat(row['Bobot (Kg)']) || 0,
                        row['Petugas'], recordedAt
                    ];
                    await client.query(queryText, values);
                }
                await client.query('COMMIT');
                resolve({ status: 'success', file: file.originalname, count: rowData.length });
            } catch (dbError) {
                await client.query('ROLLBACK');
                resolve({ status: 'error', file: file.originalname, reason: dbError.message });
            } finally {
                client.release();
            }
        });
    });
  };

  try {
    const promises = req.files.map(file => processFile(file));
    await Promise.all(promises);
    res.json({ message: 'Upload berhasil. Waktu disesuaikan dengan isi file.' });
  } catch (err) {
    console.error('System Error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan sistem.' });
  }
});

// --- HELPER TANGGAL (Asia/Jakarta Logic) ---
function getSQLDateCondition(range, year, month, week, specificDate) {
  const local_timestamp = "recorded_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'";
  const jsDate = new Date();
  
  const targetYear = year ? parseInt(year) : jsDate.getFullYear();
  const targetMonth = month ? parseInt(month) : jsDate.getMonth() + 1; 
  const tm = targetMonth.toString().padStart(2, '0');
  
  const dayOfMonth = jsDate.getDate();
  let currentWeekOfMonth = 1;
  if (dayOfMonth >= 8 && dayOfMonth <= 14) currentWeekOfMonth = 2;
  else if (dayOfMonth >= 15 && dayOfMonth <= 21) currentWeekOfMonth = 3;
  else if (dayOfMonth >= 22) currentWeekOfMonth = 4;
  const targetWeek = week ? parseInt(week) : currentWeekOfMonth;

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  let dateCondition = '';

  switch (range) {
    case 'weekly':
      let s, e;
      if (targetWeek === 1) { s = `${targetYear}-${tm}-01`; e = `${targetYear}-${tm}-07`; }
      else if (targetWeek === 2) { s = `${targetYear}-${tm}-08`; e = `${targetYear}-${tm}-14`; }
      else if (targetWeek === 3) { s = `${targetYear}-${tm}-15`; e = `${targetYear}-${tm}-21`; }
      else { 
        s = `${targetYear}-${tm}-22`;
        const endOfMonth = `(DATE_TRUNC('MONTH',TO_DATE('${targetYear}-${tm}-01','YYYY-MM-DD')) + INTERVAL '1 MONTH' - INTERVAL '1 DAY')::DATE`;
        dateCondition = `DATE(${local_timestamp}) >= '${s}' AND DATE(${local_timestamp}) <= ${endOfMonth}`;
        break; 
      }
      dateCondition = `DATE(${local_timestamp}) BETWEEN '${s}' AND '${e}'`;
      break;
    case 'monthly':
      dateCondition = `EXTRACT(MONTH FROM ${local_timestamp}) = ${targetMonth} AND EXTRACT(YEAR FROM ${local_timestamp}) = ${targetYear}`;
      break;
    case 'yearly':
      dateCondition = `EXTRACT(YEAR FROM ${local_timestamp}) = ${targetYear}`;
      break;
    default: // 'daily'
      if (specificDate) {
          dateCondition = `DATE(${local_timestamp}) = '${specificDate}'`;
      } else {
          dateCondition = `DATE(${local_timestamp}) = '${today}'`;
      }
  }
  return dateCondition;
}

// --- E. STATISTIK & RECORDS ---
// --- D. STATISTIK & DATA ---

// (Fungsi getSQLDateCondition biarkan saja, tidak berubah)

// --- D. STATISTIK & DATA (MODIFIKASI: HANYA 2 KATEGORI) ---

// Pastikan fungsi getSQLDateCondition tetap ada di atas kode ini

app.get('/api/stats', async (req, res) => {
  try {
    const { range, year, month, week, date } = req.query;
    const dateCondition = getSQLDateCondition(range, year, month, week, date);
    
    // 1. Ambil data mentah (3 kategori) dari database
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'Organik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_organik,
        COALESCE(SUM(CASE WHEN status = 'Anorganik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_anorganik,
        COALESCE(SUM(CASE WHEN status = 'Tidak Terkelola' THEN weight_kg ELSE 0 END), 0) as total_residu
      FROM waste_records WHERE ${dateCondition};
    `;
    
    const statsQuery = await pool.query(query);
    const data = statsQuery.rows[0];

    // 2. GABUNGKAN DATA DI SINI (JADI 2 KATEGORI)
    const terkelola = parseFloat(data.total_organik) + parseFloat(data.total_anorganik);
    const residu = parseFloat(data.total_residu);

    // 3. Kirim ke Frontend hanya 2 data ini
    res.json([
      { name: 'Terkelola', value: terkelola },        // Gabungan Organik + Anorganik
      { name: 'Tidak Terkelola', value: residu }      // Residu murni
    ]);
    
  } catch (err) {
    res.status(500).json({ message: 'Server error statistics.' });
  }
});
// --- F. HAPUS SEMUA DATA ---
app.delete('/api/clear-data', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE waste_records RESTART IDENTITY;');
        res.json({ message: 'Data dihapus.' });
    } catch (err) { res.status(500).json({ message: 'Error delete' }); }
});

// --- G. EKSPOR EXCEL BULANAN (LENGKAP) ---
// --- G. EKSPOR EXCEL BULANAN (FORMAT DETAIL: JENIS SAMPAH & TOTAL) ---
// --- G. EKSPOR EXCEL BULANAN (FORMAT DETAIL: JENIS SAMPAH & TOTAL) ---
app.get('/api/export/monthly', async (req, res) => {
    const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        // 1. Ambil Data
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(MONTH FROM recorded_at) = $1 AND EXTRACT(YEAR FROM recorded_at) = $2
             ORDER BY recorded_at ASC`,
            [targetMonth, targetYear]
        );

        // 2. Konfigurasi Kolom
        const areaList = ['Area Kantor', 'Area Parkir', 'Area Makan', 'Area Ruang Tunggu'];
        const structure = {
            organik: [
                { header: 'Daun Kering', keywords: ['daun', 'kering'] },
                { header: 'Sisa Makanan', keywords: ['makan', 'sisa'] }
            ],
            anorganik: [
                { header: 'Kertas', keywords: ['kertas'] },
                { header: 'Kardus', keywords: ['kardus'] },
                { header: 'Plastik', keywords: ['plastik'] },
                { header: 'Duplex', keywords: ['duplex'] },
                { header: 'Kantong', keywords: ['kantong', 'kresek'] }
            ],
            residu: [
                { header: 'Vial', keywords: ['vial'] },
                { header: 'Botol', keywords: ['botol'] },
                { header: 'Drum Vat', keywords: ['drum', 'vat'] },
                { header: 'Residu', keywords: ['residu', 'lain'] }
            ]
        };

        // 3. Proses Data
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const reportData = {};

        for (let d = 1; d <= daysInMonth; d++) {
            reportData[d] = {};
            areaList.forEach(area => {
                reportData[d][area] = {};
                [...structure.organik, ...structure.anorganik, ...structure.residu].forEach(item => {
                    reportData[d][area][item.header] = 0;
                });
            });
        }

        rows.forEach(row => {
            const day = new Date(row.recorded_at).getDate();
            const dbArea = row.area_label ? row.area_label.toLowerCase() : '';
            const dbItem = row.item_label ? row.item_label.toLowerCase() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            let targetArea = null;
            if (dbArea.includes('kantor')) targetArea = 'Area Kantor';
            else if (dbArea.includes('parkir')) targetArea = 'Area Parkir';
            else if (dbArea.includes('makan')) targetArea = 'Area Makan';
            else if (dbArea.includes('tunggu')) targetArea = 'Area Ruang Tunggu';

            if (targetArea && reportData[day]) {
                let matched = false;
                const allItems = [...structure.organik, ...structure.anorganik, ...structure.residu];
                for (const item of allItems) {
                    if (item.keywords.some(k => dbItem.includes(k))) {
                        reportData[day][targetArea][item.header] += weight;
                        matched = true;
                        break; 
                    }
                }
                if (!matched) reportData[day][targetArea]['Residu'] += weight; 
            }
        });

        // 4. Buat Excel
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan ${targetMonth}-${targetYear}`);

        // --- HEADER ---
        const colsPerArea = 15;
        const totalCols = 2 + (colsPerArea * areaList.length);

        // Helper untuk huruf kolom
        const getColLetter = (n) => {
            let s = "";
            while(n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };
        const lastColLetter = getColLetter(totalCols - 1);

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - BULAN ${targetMonth}/${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        let currentIdx = 3; 
        
        worksheet.getCell('A3').value = 'No'; worksheet.mergeCells('A3:A5');
        worksheet.getCell('B3').value = 'Tanggal'; worksheet.mergeCells('B3:B5');

        areaList.forEach(area => {
            const startCol = currentIdx;
            const endCol = currentIdx + colsPerArea - 1;
            worksheet.mergeCells(3, startCol, 3, endCol);
            worksheet.getCell(3, startCol).value = area.toUpperCase();
            
            // Baris 4
            worksheet.mergeCells(4, currentIdx, 4, currentIdx + 1);
            worksheet.getCell(4, currentIdx).value = 'Organik';
            worksheet.getCell(4, currentIdx + 2).value = 'Total Organik';

            const anorgStart = currentIdx + 3;
            worksheet.mergeCells(4, anorgStart, 4, anorgStart + 4);
            worksheet.getCell(4, anorgStart).value = 'Anorganik';
            worksheet.getCell(4, anorgStart + 5).value = 'Total Anorganik';

            worksheet.getCell(4, anorgStart + 6).value = 'Total Terkelola';

            const residuStart = anorgStart + 7;
            worksheet.mergeCells(4, residuStart, 4, residuStart + 3);
            worksheet.getCell(4, residuStart).value = 'Sampah Tidak Terkelola';
            worksheet.getCell(4, residuStart + 4).value = 'Total Tidak Terkelola'; 

            // Baris 5 (Nama Item)
            let subIdx = currentIdx;
            structure.organik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 

            structure.anorganik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 

            worksheet.getCell(5, subIdx++).value = '(Kg)'; 

            structure.residu.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 

            currentIdx += colsPerArea;
        });

        // Styling
        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            // --- PERBAIKAN TINGGI BARIS HEADER ---
            row.height = 30; // Biar muat teks 2 baris (wrap text)
            
            for (let c = 1; c <= totalCols; c++) {
                const cell = row.getCell(c);
                cell.font = { bold: true, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

                const colModulo = (c - 2) % colsPerArea; 
                if (colModulo === 0 && c > 2) { 
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; 
                     cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; 
                }
            }
        }

        // 5. ISI DATA
        const grandTotals = new Array(totalCols + 1).fill(0);

        for (let d = 1; d <= daysInMonth; d++) {
            const rowValues = [d, d];
            
            areaList.forEach(area => {
                const r = reportData[d][area];
                let sumOrganik = 0;
                structure.organik.forEach(i => sumOrganik += (r[i.header] || 0));
                let sumAnorganik = 0;
                structure.anorganik.forEach(i => sumAnorganik += (r[i.header] || 0));
                let sumResidu = 0;
                structure.residu.forEach(i => sumResidu += (r[i.header] || 0));
                const totalTerkelola = sumOrganik + sumAnorganik;

                structure.organik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumOrganik || '-');
                structure.anorganik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumAnorganik || '-');
                rowValues.push(totalTerkelola || '-');
                structure.residu.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumResidu || '-');
            });

            const excelRow = worksheet.getRow(d + 5);
            excelRow.values = rowValues;
            excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center' };
                const val = cell.value;
                if (typeof val === 'number') {
                    grandTotals[colNumber] = (grandTotals[colNumber] || 0) + val;
                }
            });
        }

        // 6. FOOTER
        const rowTotalKg = daysInMonth + 6;
        const rowTotalTon = rowTotalKg + 1;
        const rowAvg = rowTotalKg + 2;

        worksheet.getCell(`A${rowTotalKg}`).value = 'Total (kg/bln)';
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total (ton/bln)';
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata (kg/hari)';

        for (let c = 3; c <= totalCols; c++) {
            const totalVal = grandTotals[c] || 0;
            worksheet.getCell(rowTotalKg, c).value = totalVal;
            worksheet.getCell(rowTotalTon, c).value = (totalVal / 1000);
            worksheet.getCell(rowTotalTon, c).numFmt = '0.000';
            worksheet.getCell(rowAvg, c).value = (totalVal / daysInMonth);
            worksheet.getCell(rowAvg, c).numFmt = '0.00';
        }

        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const row = worksheet.getRow(r);
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
        });

        // --- PERBAIKAN LEBAR KOLOM (AGAR MUAT) ---
        worksheet.getColumn(1).width = 5;  // No
        worksheet.getColumn(2).width = 8;  // Tanggal
        for(let i=3; i<=totalCols; i++) {
            worksheet.getColumn(i).width = 17; // LEBARKAN JADI 17 (Dulu 12)
        }

        // Kirim
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan Timbulan Sampah Bulan${targetMonth}-${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel:', err);
        res.status(500).json({ message: 'Gagal export excel' });
    }
});

// --- H. EKSPOR EXCEL TAHUNAN (FORMAT DETAIL: JENIS SAMPAH & TOTAL) ---
app.get('/api/export/yearly', async (req, res) => {
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        // 1. Ambil Data Setahun Penuh
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(YEAR FROM recorded_at) = $1
             ORDER BY recorded_at ASC`,
            [targetYear]
        );

        // 2. Konfigurasi Kolom (Sama persis dengan Bulanan)
        const areaList = ['Area Kantor', 'Area Parkir', 'Area Makan', 'Area Ruang Tunggu'];
        const structure = {
            organik: [
                { header: 'Daun Kering', keywords: ['daun', 'kering'] },
                { header: 'Sisa Makanan', keywords: ['makan', 'sisa'] }
            ],
            anorganik: [
                { header: 'Kertas', keywords: ['kertas'] },
                { header: 'Kardus', keywords: ['kardus'] },
                { header: 'Plastik', keywords: ['plastik'] },
                { header: 'Duplex', keywords: ['duplex'] },
                { header: 'Kantong', keywords: ['kantong', 'kresek'] }
            ],
            residu: [
                { header: 'Vial', keywords: ['vial'] },
                { header: 'Botol', keywords: ['botol'] },
                { header: 'Drum Vat', keywords: ['drum', 'vat'] },
                { header: 'Residu', keywords: ['residu', 'lain'] }
            ]
        };

        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        // 3. Proses Data (Kelompokkan per Bulan 0-11)
        const reportData = {};
        for (let m = 0; m < 12; m++) {
            reportData[m] = {};
            areaList.forEach(area => {
                reportData[m][area] = {};
                [...structure.organik, ...structure.anorganik, ...structure.residu].forEach(item => {
                    reportData[m][area][item.header] = 0;
                });
            });
        }

        rows.forEach(row => {
            const dateObj = new Date(row.recorded_at);
            const monthIndex = dateObj.getMonth(); // 0 = Januari, 11 = Desember
            
            const dbArea = row.area_label ? row.area_label.toLowerCase() : '';
            const dbItem = row.item_label ? row.item_label.toLowerCase() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            let targetArea = null;
            if (dbArea.includes('kantor')) targetArea = 'Area Kantor';
            else if (dbArea.includes('parkir')) targetArea = 'Area Parkir';
            else if (dbArea.includes('makan')) targetArea = 'Area Makan';
            else if (dbArea.includes('tunggu')) targetArea = 'Area Ruang Tunggu';

            if (targetArea) {
                let matched = false;
                const allItems = [...structure.organik, ...structure.anorganik, ...structure.residu];
                for (const item of allItems) {
                    if (item.keywords.some(k => dbItem.includes(k))) {
                        reportData[monthIndex][targetArea][item.header] += weight;
                        matched = true;
                        break; 
                    }
                }
                if (!matched) reportData[monthIndex][targetArea]['Residu'] += weight; 
            }
        });

        // 4. Buat Excel
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Tahun ${targetYear}`);

        // --- HEADER ---
        const colsPerArea = 15;
        const totalCols = 2 + (colsPerArea * areaList.length);

        // Helper Huruf Kolom
        const getColLetter = (n) => {
            let s = "";
            while(n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };
        const lastColLetter = getColLetter(totalCols - 1);

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - TAHUN ${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        let currentIdx = 3; 
        
        worksheet.getCell('A3').value = 'No'; worksheet.mergeCells('A3:A5');
        worksheet.getCell('B3').value = 'Bulan'; worksheet.mergeCells('B3:B5'); // Bedanya disini: BULAN

        areaList.forEach(area => {
            const startCol = currentIdx;
            const endCol = currentIdx + colsPerArea - 1;
            worksheet.mergeCells(3, startCol, 3, endCol);
            worksheet.getCell(3, startCol).value = area.toUpperCase();
            
            // Baris 4
            worksheet.mergeCells(4, currentIdx, 4, currentIdx + 1);
            worksheet.getCell(4, currentIdx).value = 'Organik';
            worksheet.getCell(4, currentIdx + 2).value = 'Total Organik';

            const anorgStart = currentIdx + 3;
            worksheet.mergeCells(4, anorgStart, 4, anorgStart + 4);
            worksheet.getCell(4, anorgStart).value = 'Anorganik';
            worksheet.getCell(4, anorgStart + 5).value = 'Total Anorganik';
            worksheet.getCell(4, anorgStart + 6).value = 'Total Terkelola';

            const residuStart = anorgStart + 7;
            worksheet.mergeCells(4, residuStart, 4, residuStart + 3);
            worksheet.getCell(4, residuStart).value = 'Sampah Tidak Terkelola';
            worksheet.getCell(4, residuStart + 4).value = 'Total Tidak Terkelola'; 

            // Baris 5 (Nama Item)
            let subIdx = currentIdx;
            structure.organik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 
            structure.anorganik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 
            structure.residu.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; 

            currentIdx += colsPerArea;
        });

        // Styling Header
        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            row.height = 30; // HEADER TINGGI
            for (let c = 1; c <= totalCols; c++) {
                const cell = row.getCell(c);
                cell.font = { bold: true, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                
                const colModulo = (c - 2) % colsPerArea; 
                if (colModulo === 0 && c > 2) { 
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; 
                     cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; 
                }
            }
        }

        // 5. ISI DATA (Looping 12 Bulan)
        const grandTotals = new Array(totalCols + 1).fill(0);

        for (let m = 0; m < 12; m++) {
            const rowValues = [m + 1, monthNames[m]]; // No, Nama Bulan
            
            areaList.forEach(area => {
                const r = reportData[m][area];
                let sumOrganik = 0; structure.organik.forEach(i => sumOrganik += (r[i.header] || 0));
                let sumAnorganik = 0; structure.anorganik.forEach(i => sumAnorganik += (r[i.header] || 0));
                let sumResidu = 0; structure.residu.forEach(i => sumResidu += (r[i.header] || 0));
                const totalTerkelola = sumOrganik + sumAnorganik;

                structure.organik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumOrganik || '-');
                structure.anorganik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumAnorganik || '-');
                rowValues.push(totalTerkelola || '-');
                structure.residu.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumResidu || '-');
            });

            const excelRow = worksheet.getRow(m + 6);
            excelRow.values = rowValues;
            excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center' };
                const val = cell.value;
                if (typeof val === 'number') {
                    grandTotals[colNumber] = (grandTotals[colNumber] || 0) + val;
                }
            });
        }

        // 6. FOOTER
        const rowTotalKg = 12 + 6; // 12 bulan + 6 baris header
        const rowTotalTon = rowTotalKg + 1;
        const rowAvg = rowTotalKg + 2;

        worksheet.getCell(`A${rowTotalKg}`).value = 'Total (kg/thn)';
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total (ton/thn)';
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata (kg/hari)';

        const daysInYear = (targetYear % 4 === 0 && targetYear % 100 > 0) || targetYear % 400 === 0 ? 366 : 365;

        for (let c = 3; c <= totalCols; c++) {
            const totalVal = grandTotals[c] || 0;
            worksheet.getCell(rowTotalKg, c).value = totalVal;
            worksheet.getCell(rowTotalTon, c).value = (totalVal / 1000);
            worksheet.getCell(rowTotalTon, c).numFmt = '0.000';
            worksheet.getCell(rowAvg, c).value = (totalVal / daysInYear);
            worksheet.getCell(rowAvg, c).numFmt = '0.00';
        }

        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const row = worksheet.getRow(r);
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
        });

        // Set Lebar Kolom
        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 15; // Bulan butuh agak lebar
        for(let i=3; i<=totalCols; i++) {
            worksheet.getColumn(i).width = 17; // LEBAR 17 (Sama kayak bulanan)
        }

        // Kirim
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan Timbulan Sampah Tahunan ${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel Tahunan:', err);
        res.status(500).json({ message: 'Gagal export tahunan' });
    }
});

// Konfigurasi Font (Pakai Roboto yang baru didownload)
// Konfigurasi Font (Kita pakai nama 'normal.ttf' agar seragam)
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
const printer = new PdfPrinter(fonts);

// --- 1. EXPORT PDF BULANAN (RINGKASAN) ---
app.get('/api/export/pdf/monthly', async (req, res) => {
  const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
  const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

  try {
    const { rows } = await pool.query(
      `SELECT * FROM waste_records 
       WHERE EXTRACT(MONTH FROM recorded_at) = $1 AND EXTRACT(YEAR FROM recorded_at) = $2`,
      [targetMonth, targetYear]
    );

    const docDefinition = generateSummaryPDF(rows, targetMonth, targetYear, 'monthly');
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Laporan_Ringkas_Bulan_${targetMonth}-${targetYear}.pdf`);
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (err) {
    console.error('Error PDF Monthly:', err);
    res.status(500).json({ message: 'Gagal membuat PDF Bulanan' });
  }
});

// --- 2. EXPORT PDF TAHUNAN (RINGKASAN) ---
app.get('/api/export/pdf/yearly', async (req, res) => {
  const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

  try {
    const { rows } = await pool.query(
      `SELECT * FROM waste_records 
       WHERE EXTRACT(YEAR FROM recorded_at) = $1`,
      [targetYear]
    );

    const docDefinition = generateSummaryPDF(rows, null, targetYear, 'yearly');

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Laporan Timbulan Sampah Tahun${targetYear}.pdf`);
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (err) {
    console.error('Error PDF Yearly:', err);
    res.status(500).json({ message: 'Gagal membuat PDF Tahunan' });
  }
});

// --- FUNGSI GENERATOR PDF ---
function generateSummaryPDF(rows, month, year, type) {
    // 1. Olah Data
    const summary = {
      'Area Kantor': { organik: 0, anorganik: 0, residu: 0 },
      'Area Parkir': { organik: 0, anorganik: 0, residu: 0 },
      'Area Makan': { organik: 0, anorganik: 0, residu: 0 },
      'Area Ruang Tunggu': { organik: 0, anorganik: 0, residu: 0 }
    };

    rows.forEach(row => {
      const dbArea = row.area_label ? row.area_label.toLowerCase() : '';
      const status = row.status ? row.status.trim() : '';
      const weight = parseFloat(row.weight_kg) || 0;

      let targetArea = null;
      if (dbArea.includes('kantor')) targetArea = 'Area Kantor';
      else if (dbArea.includes('parkir')) targetArea = 'Area Parkir';
      else if (dbArea.includes('makan')) targetArea = 'Area Makan';
      else if (dbArea.includes('tunggu')) targetArea = 'Area Ruang Tunggu';

      if (targetArea) {
        if (status === 'Organik Terpilah') summary[targetArea].organik += weight;
        else if (status === 'Anorganik Terpilah') summary[targetArea].anorganik += weight;
        else if (status === 'Tidak Terkelola') summary[targetArea].residu += weight;
      }
    });

    // 2. Body Tabel
    const tableBody = [];
    tableBody.push([
      { text: 'No', style: 'tableHeader' },
      { text: 'Lokasi / Area', style: 'tableHeader', alignment: 'left' },
      { text: 'Organik (Kg)', style: 'tableHeader' },
      { text: 'Anorganik (Kg)', style: 'tableHeader' },
      { text: 'Tidak Terkelola (Kg)', style: 'tableHeader' },
      { text: 'Total (Kg)', style: 'tableHeader', fillColor: '#eeeeee' }
    ]);

    let no = 1;
    let grandTotalOrganik = 0;
    let grandTotalAnorganik = 0;
    let grandTotalResidu = 0;

    Object.keys(summary).forEach(area => {
      const s = summary[area];
      const totalArea = s.organik + s.anorganik + s.residu;
      grandTotalOrganik += s.organik;
      grandTotalAnorganik += s.anorganik;
      grandTotalResidu += s.residu;

      tableBody.push([
        { text: no++, alignment: 'center' },
        { text: area, alignment: 'left' },
        { text: s.organik.toFixed(2), alignment: 'center' },
        { text: s.anorganik.toFixed(2), alignment: 'center' },
        { text: s.residu.toFixed(2), alignment: 'center' },
        { text: totalArea.toFixed(2), alignment: 'center', bold: true }
      ]);
    });

    const grandTotalAll = grandTotalOrganik + grandTotalAnorganik + grandTotalResidu;
    tableBody.push([
      { text: 'TOTAL KESELURUHAN', colSpan: 2, style: 'tableFooter', alignment: 'center' },
      {},
      { text: grandTotalOrganik.toFixed(2), style: 'tableFooter', alignment: 'center' },
      { text: grandTotalAnorganik.toFixed(2), style: 'tableFooter', alignment: 'center' },
      { text: grandTotalResidu.toFixed(2), style: 'tableFooter', alignment: 'center' },
      { text: grandTotalAll.toFixed(2), style: 'tableFooter', alignment: 'center' }
    ]);

    // 3. Judul
    const titleText = type === 'monthly' 
        ? `LAPORAN RINGKASAN BULAN ${month}/${year}` 
        : `LAPORAN RINGKASAN TAHUN ${year}`;

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      content: [
        { text: 'REKAMAN TIMBULAN SAMPAH', style: 'header' },
        { text: titleText, style: 'subheader' },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*', '*', '*'],
            body: tableBody
          },
          layout: {
            fillColor: function (rowIndex) { return (rowIndex === 0) ? '#4CAF50' : null; }
          }
        },
        { text: '\n\n' },
        { text: `Dicetak pada: ${new Date().toLocaleString('id-ID')}`, style: 'small' }
      ],
      styles: {
        header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
        tableHeader: { bold: true, fontSize: 11, color: 'white', alignment: 'center', margin: [0, 5, 0, 5] },
        tableFooter: { bold: true, fontSize: 11, fillColor: '#dcedc8', margin: [0, 5, 0, 5] },
        small: { fontSize: 8, italics: true, alignment: 'right', color: 'grey' }
      },
      // INI KUNCINYA: Gunakan Helvetica sebagai Default Font
      defaultStyle: {
        font: 'Helvetica'
      }
    };
}
// --- EXPORT APP (PENTING UNTUK VERCEL) ---
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}

module.exports = app;