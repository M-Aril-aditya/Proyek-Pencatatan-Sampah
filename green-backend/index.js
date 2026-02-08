require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const excel = require('exceljs');
const { Readable } = require('stream');
const PDFDocument = require('pdfkit-table');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. KONEKSI DATABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. CONFIG MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 3. MIDDLEWARE ---
// --- GANTI BAGIAN CORS DENGAN INI (Anti Error 500) ---
app.use((req, res, next) => {
  // Izinkan akses dari mana saja
  res.header("Access-Control-Allow-Origin", "*"); 
  // Izinkan semua tombol: Lihat, Tambah, Edit, Hapus
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); 
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Jika browser bertanya (Preflight), langsung jawab OK
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// --- 4. ROUTES UTAMA ---

app.get('/', (req, res) => {
    res.send('Green Backend is Running!');
});

// --- A. LOGIN ADMIN ---
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
    res.status(500).json({ message: 'Server error saat login.' });
  }
});

// --- B. LOGIN PETUGAS ---
app.post('/api/login-petugas', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM petugas WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Petugas tidak ditemukan' });

        const petugas = result.rows[0];
        if (password !== petugas.password) {
            return res.status(401).json({ message: 'Password salah' });
        }

        res.json({ message: 'Login Berhasil', role: 'petugas', username: petugas.username });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- C. MANAJEMEN PETUGAS ---
app.get('/api/petugas', async (req, res) => {
    try {
        // Kita ubah jadi 'SELECT *' agar Password juga ikut terkirim
        const result = await pool.query('SELECT * FROM petugas ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Gagal mengambil data' });
    }
});

app.post('/api/petugas', async (req, res) => {
    const { username, password } = req.body;
    try {
        const cek = await pool.query('SELECT * FROM petugas WHERE username = $1', [username]);
        if (cek.rows.length > 0) return res.status(400).json({ message: 'Username sudah ada!' });

        const newUser = await pool.query(
            'INSERT INTO petugas (username, password) VALUES ($1, $2) RETURNING *',
            [username, password]
        );
        res.json({ message: 'Petugas berhasil dibuat', petugas: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Gagal menambah petugas' });
    }
});

// Hapus sampah buatan dia dulu, baru hapus orangnya
// --- GANTI BAGIAN DELETE DENGAN INI ---
app.delete('/api/petugas/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Mulai mode aman

        const { id } = req.params;

        // 1. Cek nama petugas dulu
        const userRes = await client.query('SELECT username FROM petugas WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Petugas tidak ditemukan" });
        }
        const usernamePetugas = userRes.rows[0].username;

        // 2. HAPUS SEMUA SAMPAH yang pernah dicatat dia
        // (Ini langkah penting agar tidak error database)
        await client.query('DELETE FROM waste_records WHERE petugas_name = $1', [usernamePetugas]);

        // 3. BARU HAPUS ORANGNYA
        await client.query('DELETE FROM petugas WHERE id = $1', [id]);

        await client.query('COMMIT'); // Simpan perubahan
        res.json({ message: 'Petugas dan datanya berhasil dihapus' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error Delete:", err.message);
        res.status(500).json({ message: 'Gagal menghapus data' });
    } finally {
        client.release();
    }
});

// UPDATE USER
app.put('/api/petugas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;

        // Cek apakah user ada
        const cekUser = await pool.query('SELECT * FROM petugas WHERE id = $1', [id]);
        if (cekUser.rows.length === 0) {
            return res.status(404).json({ message: "Petugas tidak ditemukan" });
        }

        // Lakukan Update
        await pool.query(
            "UPDATE petugas SET username = $1, password = $2 WHERE id = $3",
            [username, password, id]
        );

        res.json({ message: "Data petugas berhasil diperbarui!" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error saat update petugas" });
    }
});

// UPDATE DATA PETUGAS
app.put('/petugas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    
    // Update data di database
    // Catatan: Ini akan mengupdate username dan password langsung
    const updatePetugas = await pool.query(
      "UPDATE petugas SET username = $1, password = $2 WHERE id = $3",
      [username, password, id]
    );

    res.json("Data petugas berhasil diperbarui!");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// --- D. UPLOAD CSV (UPDATE: FITUR TANGGAL MANUAL) ---
app.post('/api/upload', upload.array('csvFiles'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'Tidak ada file.' });

  // Tangkap tanggal manual dari body (format YYYY-MM-DD dari frontend)
  const manualDate = req.body.date; 

  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      const rowData = [];
      Readable.from(file.buffer)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
        .on('data', (data) => rowData.push(data))
        .on('error', (err) => reject(err))
        .on('end', async () => {
            if (rowData.length === 0) return resolve({ status: 'error', file: file.originalname, reason: 'File kosong' });
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const row of rowData) {
                    // LOGIKA TANGGAL: Jika ada input manual, pakai itu. Jika tidak, pakai waktu sekarang.
                    let recordedAt = manualDate ? new Date(manualDate) : new Date(); 

                    const queryText = `
                    INSERT INTO waste_records 
                    (area_label, item_label, status, weight_kg, petugas_name, recorded_at) -- Hapus 'pengelola'
                    VALUES ($1, $2, $3, $4, $5, $6) -- Kurangi satu placeholder ($7 jadi $6)
                    `;
                    const values = [
                    row['Area'], row['Nama Item'], 
    // Hapus row['Pengelola']
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
    res.json({ message: 'Upload berhasil.' });
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan sistem.' });
  }
});

// --- HELPER DATE ---
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
    default: 
      if (specificDate) dateCondition = `DATE(${local_timestamp}) = '${specificDate}'`;
      else dateCondition = `DATE(${local_timestamp}) = '${today}'`;
  }
  return dateCondition;
}

// --- E. STATISTIK (UPDATE: FORMAT PIE CHART TERKELOLA VS TIDAK) ---
app.get('/api/stats', async (req, res) => {
  const { range, year, month, week, date } = req.query;
  try {
    const dateCondition = getSQLDateCondition(range, year, month, week, date);
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'Organik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_organik,
        COALESCE(SUM(CASE WHEN status = 'Anorganik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_anorganik,
        COALESCE(SUM(CASE WHEN status = 'Tidak Terkelola' THEN weight_kg ELSE 0 END), 0) as total_residu
      FROM waste_records WHERE ${dateCondition};
    `;
    const statsQuery = await pool.query(query);
    const data = statsQuery.rows[0];
    
    // HITUNG TOTAL TERKELOLA (Organik + Anorganik)
    const terkelola = parseFloat(data.total_organik) + parseFloat(data.total_anorganik);
    const residu = parseFloat(data.total_residu);

    // Format Response untuk Pie Chart
    res.json([
      { name: 'Terkelola', value: terkelola },
      { name: 'Tidak Terkelola', value: residu }
    ]);
  } catch (err) {
    res.status(500).json({ message: 'Server error statistics.' });
  }
});

// Update endpoint ini di index.js
app.get('/api/records', async (req, res) => {
  const { range, year, month, week, date } = req.query;
  try {
    const dateCondition = getSQLDateCondition(range, year, month, week, date);
    
    // PERUBAHAN DISINI: Tambahkan 'id' di paling depan
    // Pastikan ada "id" di paling depan
    const query = `
     SELECT id, area_label, item_label, status, weight_kg, petugas_name, recorded_at
     FROM waste_records WHERE ${dateCondition} ORDER BY recorded_at DESC;
    `;
    
    const recordsQuery = await pool.query(query);
    res.json(recordsQuery.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error records.' });
  }
});

// --- F. HAPUS DATA ---
// --- FITUR HAPUS SATUAN (PER ID) ---
// Endpoint Hapus
app.delete('/api/records/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM waste_records WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json({ message: 'Data berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data.' });
  }
});

// --- G. EKSPOR EXCEL BULANAN ---
// --- G. EKSPOR EXCEL BULANAN ---
// ==========================================
// 1. EKSPOR EXCEL BULANAN (REVISI WARNA)
// ==========================================
// --- ENDPOINT EXPORT EXCEL BULANAN (FIXED) ---
app.get('/api/export/monthly', async (req, res) => {
    const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(MONTH FROM recorded_at) = $1 AND EXTRACT(YEAR FROM recorded_at) = $2
             ORDER BY recorded_at ASC`,
            [targetMonth, targetYear]
        );

        // --- DEFINISI WARNA ---
        const colors = {
            kantor:     'FFADD8E6', // Biru
            parkir:     'FF90EE90', // Hijau Muda
            makan:      'FFFFA500', // Orange
            tunggu:     'FFFFFF00', // Kuning
            terkelola:  { header: 'FF32CD32', cell: 'FFE8F5E9' }, // Hijau Tua & Hijau Pucat
            residu:     { header: 'FFFF0000', cell: 'FFFFEBEE' }  // Merah & Merah Pucat
        };

        const areaList = [
            { name: 'Area Kantor', color: colors.kantor },
            { name: 'Area Parkir', color: colors.parkir },
            { name: 'Area Makan',  color: colors.makan },
            { name: 'Area Ruang Tunggu', color: colors.tunggu }
        ];

        // Struktur Item
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
                { header: 'Kantong', keywords: ['kantong', 'kresek', 'semen'] } 
            ],
            residu: [
                { header: 'Drum Vat', keywords: ['drum', 'vat'] },
                { header: 'Residu', keywords: ['residu', 'lain'] }
            ]
        };

        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const reportData = {};

        // Inisialisasi Data
        for (let d = 1; d <= daysInMonth; d++) {
            reportData[d] = {};
            areaList.forEach(area => {
                reportData[d][area.name] = {};
                [...structure.organik, ...structure.anorganik, ...structure.residu].forEach(item => {
                    reportData[d][area.name][item.header] = 0;
                });
            });
        }

        // Mapping Data dari Database
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

        const workbook = new ExcelJS.Workbook(); // Pastikan Import ExcelJS benar
        const worksheet = workbook.addWorksheet(`Laporan ${targetMonth}-${targetYear}`);

        // --- PERBAIKAN: HITUNG LEBAR KOLOM YANG BENAR ---
        // Organik(2) + Sub(1) + Anorg(5) + Sub(1) + Terkelola(1) + Residu(2) + TakTerkelola(1) = 13
        const colsPerArea = 13; 
        const totalAreaCols = 2 + (colsPerArea * areaList.length);
        const finalTotalCols = totalAreaCols + 2; 

        // Helper Huruf Excel
        const getColLetter = (n) => {
            let s = "";
            while(n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };
        const lastColLetter = getColLetter(finalTotalCols - 1);

        // Header Judul
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - BULAN ${targetMonth}/${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        let currentIdx = 3; 
        
        // Header No & Tanggal
        worksheet.getCell('A3').value = 'No'; worksheet.mergeCells('A3:A5');
        worksheet.getCell('B3').value = 'Tanggal'; worksheet.mergeCells('B3:B5');

        const specialColsIndex = []; 

        areaList.forEach(area => {
            const startCol = currentIdx;
            const endCol = currentIdx + colsPerArea - 1;
            
            // 1. Header Nama Area
            worksheet.mergeCells(3, startCol, 3, endCol);
            const cellArea = worksheet.getCell(3, startCol);
            cellArea.value = area.name.toUpperCase();
            cellArea.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: area.color } }; 

            // 2. Sub Header (Kategori)
            // Organik
            worksheet.mergeCells(4, currentIdx, 4, currentIdx + 1);
            worksheet.getCell(4, currentIdx).value = 'Organik';
            worksheet.getCell(4, currentIdx + 2).value = 'Total Organik';

            // Anorganik
            const anorgStart = currentIdx + 3;
            worksheet.mergeCells(4, anorgStart, 4, anorgStart + 4);
            worksheet.getCell(4, anorgStart).value = 'Anorganik';
            worksheet.getCell(4, anorgStart + 5).value = 'Total Anorganik';
            
            // Total Terkelola (PERBAIKAN INDEX)
            const colTerkelolaLocal = anorgStart + 6; 
            worksheet.getCell(4, colTerkelolaLocal).value = 'Total Terkelola';
            specialColsIndex.push({ index: colTerkelolaLocal, type: 'terkelola' });

            // Residu
            const residuStart = colTerkelolaLocal + 1;
            worksheet.mergeCells(4, residuStart, 4, residuStart + 1); // Merge 2 kolom residu
            worksheet.getCell(4, residuStart).value = 'Sampah Tidak Terkelola';
            
            // Total Tidak Terkelola (PERBAIKAN INDEX)
            const colResiduLocal = residuStart + 2;
            worksheet.getCell(4, colResiduLocal).value = 'Total Tidak Terkelola'; 
            specialColsIndex.push({ index: colResiduLocal, type: 'residu' });

            // 3. Item Headers (Baris 5)
            let subIdx = currentIdx;
            structure.organik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Subtotal Org
            structure.anorganik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Subtotal Anorg
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Unit Total Terkelola
            structure.residu.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Unit Total Tidak Terkelola

            currentIdx += colsPerArea;
        });

        // --- HEADER GRAND TOTAL (UJUNG KANAN) ---
        const colGrandTerkelola = totalAreaCols + 1;
        const colGrandTidakTerkelola = totalAreaCols + 2;

        worksheet.mergeCells(3, colGrandTerkelola, 5, colGrandTerkelola);
        const cellGT = worksheet.getCell(3, colGrandTerkelola);
        cellGT.value = "TOTAL SAMPAH TERKELOLA SETIAP AREA";
        cellGT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } }; 
        cellGT.font = { bold: true, size: 9 };
        cellGT.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        
        worksheet.mergeCells(3, colGrandTidakTerkelola, 5, colGrandTidakTerkelola);
        const cellGTT = worksheet.getCell(3, colGrandTidakTerkelola);
        cellGTT.value = "TOTAL SAMPAH TIDAK TERKELOLA SETIAP AREA";
        cellGTT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } }; 
        cellGTT.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cellGTT.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Style Header Global
        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            row.height = 30; 
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                // Pastikan border grand total tergambar
                if (colNumber > totalAreaCols && colNumber <= finalTotalCols) {
                     cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                }
                
                // Style Font umum
                if (!cell.font) cell.font = { bold: true, size: 9 };
                cell.alignment = Object.assign({}, cell.alignment || {}, { horizontal: 'center', vertical: 'middle', wrapText: true });

                // No & Tanggal -> Abu abu
                if (colNumber <= 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; 
                
                // Warnai Sub-Header Spesial (Terkelola/Residu)
                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol && r > 3) { 
                    if (specialCol.type === 'terkelola') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                    } else if (specialCol.type === 'residu') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                }
            });
        }

        // --- ISI DATA ---
        const grandTotals = new Array(finalTotalCols + 1).fill(0);

        for (let d = 1; d <= daysInMonth; d++) {
            const rowValues = [d, d];
            let dailyGrandTerkelola = 0;
            let dailyGrandTidakTerkelola = 0;

            areaList.forEach(area => {
                const r = reportData[d][area.name];
                
                let sumOrganik = 0; structure.organik.forEach(i => sumOrganik += (r[i.header] || 0));
                let sumAnorganik = 0; structure.anorganik.forEach(i => sumAnorganik += (r[i.header] || 0));
                let sumResidu = 0; structure.residu.forEach(i => sumResidu += (r[i.header] || 0));
                
                const totalTerkelolaArea = sumOrganik + sumAnorganik;

                dailyGrandTerkelola += totalTerkelolaArea;
                dailyGrandTidakTerkelola += sumResidu;

                structure.organik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumOrganik || '-');
                structure.anorganik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumAnorganik || '-');
                rowValues.push(totalTerkelolaArea || '-'); // Kolom Terkelola Local
                structure.residu.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumResidu || '-'); // Kolom Residu Local
            });

            // Push Grand Total ke Array Data
            rowValues.push(dailyGrandTerkelola || '-');
            rowValues.push(dailyGrandTidakTerkelola || '-');

            const excelRow = worksheet.getRow(d + 5);
            excelRow.values = rowValues;
            
            // --- PEWARNAAN BARIS DATA ---
            excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center' };
                
                const val = cell.value;
                if (typeof val === 'number') grandTotals[colNumber] = (grandTotals[colNumber] || 0) + val;

                // Warnai Kolom Spesial
                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol) {
                    if (specialCol.type === 'terkelola') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.cell } }; 
                    } else if (specialCol.type === 'residu') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.cell } }; 
                    }
                } 
                else if (colNumber === colGrandTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.cell } };
                } else if (colNumber === colGrandTidakTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.cell } };
                }
            });
        }

        // --- FOOTER (TOTAL BAWAH) ---
        const rowTotalKg = daysInMonth + 6;
        const rowTotalTon = rowTotalKg + 1;
        const rowAvg = rowTotalKg + 2;

        worksheet.getCell(`A${rowTotalKg}`).value = 'Total (kg/bln)';
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total (ton/bln)';
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata (kg/hari)';

        for (let c = 3; c <= finalTotalCols; c++) {
            const totalVal = grandTotals[c] || 0;
            
            const cellKg = worksheet.getCell(rowTotalKg, c);
            cellKg.value = totalVal;
            
            const cellTon = worksheet.getCell(rowTotalTon, c);
            cellTon.value = (totalVal / 1000);
            cellTon.numFmt = '0.000';
            
            const cellAvg = worksheet.getCell(rowAvg, c);
            cellAvg.value = (totalVal / daysInMonth);
            cellAvg.numFmt = '0.00';
        }

        // Style Footer
        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const row = worksheet.getRow(r);
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { bold: true };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                
                // Warnai Footer
                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol) {
                    if (specialCol.type === 'terkelola') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                    else if (specialCol.type === 'residu') {
                         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                         cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                } else if (colNumber === colGrandTerkelola) {
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                } else if (colNumber === colGrandTidakTerkelola) {
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                     cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                }
            });
        });

        // Lebar Kolom
        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 8; 
        for(let i=3; i<=finalTotalCols; i++) {
            worksheet.getColumn(i).width = 17; 
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Sampah_Bulan_${targetMonth}-${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel:', err);
        res.status(500).json({ message: 'Gagal export excel' });
    }
});



// --- I. EKSPOR PDF BULANAN (FORMAT PECAH PER AREA) ---
 

// --- I. EKSPOR PDF BULANAN (LAYOUT PERSIS EXCEL PER HALAMAN) ---
app.get('/api/export/pdf-monthly', async (req, res) => {
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

        // 2. Setup Dokumen PDF (Landscape A4)
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        
        // Setup Header Response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Limbah_${targetMonth}-${targetYear}.pdf`);
        doc.pipe(res);

        // 3. Definisi Struktur & Warna (Sama persis dengan Excel)
        const areas = [
            { id: 'kantor', label: 'AREA KANTOR', color: '#ADD8E6' },      // Biru
            { id: 'parkir', label: 'AREA PARKIR', color: '#90EE90' },      // Hijau Muda
            { id: 'makan',  label: 'AREA MAKAN',  color: '#FFA500' },      // Orange
            { id: 'tunggu', label: 'AREA RUANG TUNGGU', color: '#FFFF00' } // Kuning
        ];

        // Struktur Item (Vial & Botol sudah dihapus)
        const structure = {
            organik: ['Daun Kering', 'Sisa Makanan'],
            anorganik: ['Kertas', 'Kardus', 'Plastik', 'Duplex', 'Kantong Semen'],
            residu: ['Drum Vat', 'Residu Lainnya']
        };

        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

        // 4. LOOPING PEMBUATAN HALAMAN (1 Area = 1 Halaman)
        for (const [index, area] of areas.entries()) {
            if (index > 0) doc.addPage(); // Tambah halaman baru untuk area berikutnya

            // -- Judul Halaman --
            doc.fontSize(14).font('Helvetica-Bold').text(`REKAMAN TIMBULAN SAMPAH - ${area.label}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Periode: ${targetMonth}/${targetYear}`, { align: 'center' });
            doc.moveDown(1);

            // -- Persiapan Data Tabel --
            const tableBody = [];
            // Array untuk menyimpan total vertikal (untuk Footer)
            // Jumlah kolom: Tgl(1) + Org(2) + TotOrg(1) + Anorg(5) + TotAnorg(1) + Terkelola(1) + Res(2) + TotRes(1) = 14 Kolom
            const colCount = 1 + structure.organik.length + 1 + structure.anorganik.length + 1 + 1 + structure.residu.length + 1;
            const verticalTotals = new Array(colCount).fill(0);

            // A. Loop Hari (1 - 30/31)
            for (let d = 1; d <= daysInMonth; d++) {
                // Filter data harian untuk area ini
                const dailyRecords = rows.filter(r => {
                    const rDate = new Date(r.recorded_at);
                    const rArea = r.area_label ? r.area_label.toLowerCase() : '';
                    return rDate.getDate() === d && rArea.includes(area.id);
                });

                const rowData = [d.toString()]; // Kolom 1: Tanggal
                let colIdx = 1; // Tracker index kolom untuk penjumlahan vertikal

                // 1. Organik
                let totalOrg = 0;
                structure.organik.forEach(item => {
                    const found = dailyRecords.find(r => r.item_label.toLowerCase().includes(item.toLowerCase()));
                    const w = found ? parseFloat(found.weight_kg) : 0;
                    rowData.push(w === 0 ? '-' : w.toFixed(1));
                    totalOrg += w;
                    verticalTotals[colIdx++] += w;
                });
                rowData.push(totalOrg.toFixed(1)); verticalTotals[colIdx++] += totalOrg;

                // 2. Anorganik
                let totalAnorg = 0;
                structure.anorganik.forEach(item => {
                    const found = dailyRecords.find(r => r.item_label.toLowerCase().includes(item.toLowerCase()));
                    const w = found ? parseFloat(found.weight_kg) : 0;
                    rowData.push(w === 0 ? '-' : w.toFixed(1));
                    totalAnorg += w;
                    verticalTotals[colIdx++] += w;
                });
                rowData.push(totalAnorg.toFixed(1)); verticalTotals[colIdx++] += totalAnorg;

                // 3. TOTAL TERKELOLA (HIJAU)
                const grandTerkelola = totalOrg + totalAnorg;
                rowData.push(grandTerkelola.toFixed(1)); verticalTotals[colIdx++] += grandTerkelola;

                // 4. Residu
                let totalRes = 0;
                structure.residu.forEach(item => {
                    const found = dailyRecords.find(r => r.item_label.toLowerCase().includes(item.toLowerCase()) || 
                                                    (item === 'Residu Lainnya' && r.status === 'Tidak Terkelola' && !r.item_label.toLowerCase().includes('drum')));
                    const w = found ? parseFloat(found.weight_kg) : 0;
                    rowData.push(w === 0 ? '-' : w.toFixed(1));
                    totalRes += w;
                    verticalTotals[colIdx++] += w;
                });
                // 5. TOTAL TIDAK TERKELOLA (MERAH)
                rowData.push(totalRes.toFixed(1)); verticalTotals[colIdx++] += totalRes;

                tableBody.push(rowData);
            }

            // B. Tambahkan FOOTER (Total Kg, Ton, Avg) - SAMA PERSIS EXCEL
            const rowTotalKg = ['Total (kg)'];
            const rowTotalTon = ['Total (ton)'];
            const rowAvg = ['Rata-rata'];

            // Mulai dari index 1 karena index 0 adalah Label Baris
            for(let i=1; i<colCount; i++) {
                const val = verticalTotals[i];
                rowTotalKg.push(val.toFixed(1));
                rowTotalTon.push((val / 1000).toFixed(3));
                rowAvg.push((val / daysInMonth).toFixed(2));
            }

            // Masukkan Footer ke Body Tabel
            tableBody.push(rowTotalKg);
            tableBody.push(rowTotalTon);
            tableBody.push(rowAvg);

            // -- DEFINISI HEADER KOLOM --
            const headers = [
                "Tgl", 
                ...structure.organik, "Tot Org",
                ...structure.anorganik, "Tot Anorg", 
                "TERKELOLA", // Kolom Hijau
                ...structure.residu, "RESIDU" // Kolom Merah
            ];

            // -- RENDER TABEL --
            const table = {
                headers: headers,
                rows: tableBody,
            };

            // Hitung Index Kolom Spesial untuk Pewarnaan
            // Tanggal(1) + Org + TotOrg(1) + Anorg + TotAnorg(1)
            const idxTerkelola = 1 + structure.organik.length + 1 + structure.anorganik.length + 1; 
            // idxTerkelola + 1 (kolom itu sendiri) + Residu
            const idxResidu = idxTerkelola + 1 + structure.residu.length;

            await doc.table(table, {
                width: 770, // Lebar penuh A4 Landscape
                padding: 3,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7),
                prepareRow: (row, indexColumn, indexRow, rect, rowData) => {
                    doc.font("Helvetica").fontSize(7);
                    
                    // 1. WARNA HEADER (Baris paling atas)
                    if (indexRow === 0) {
                        doc.addBackground(rect, area.color, 0.3); // Warna sesuai Area
                    }

                    // 2. WARNA FOOTER (3 Baris Terakhir)
                    // daysInMonth adalah jumlah data harian. Baris setelahnya adalah footer.
                    if (indexRow > daysInMonth) {
                         // Warnai footer kolom Terkelola (Hijau)
                         if (indexColumn === idxTerkelola) {
                            doc.addBackground(rect, '#90EE90', 0.5); // Hijau lebih pekat
                         } 
                         // Warnai footer kolom Residu (Merah)
                         else if (indexColumn === idxResidu) {
                            doc.addBackground(rect, '#FFCDD2', 0.5); // Merah lebih pekat
                         } 
                         // Sisanya abu-abu
                         else {
                            doc.addBackground(rect, '#EEEEEE', 0.5);
                         }
                         doc.font("Helvetica-Bold"); // Footer di-Bold
                    }

                    // 3. WARNA KOLOM VERTIKAL (DATA)
                    // Jika bukan header & bukan footer, warnai kolom spesifik
                    if (indexRow > 0 && indexRow <= daysInMonth) {
                        if (indexColumn === idxTerkelola) {
                            doc.addBackground(rect, '#E8F5E9', 0.5); // Hijau Pucat
                        }
                        if (indexColumn === idxResidu) {
                            doc.addBackground(rect, '#FFEBEE', 0.5); // Merah Pucat
                        }
                    }
                },
            });
        }

        doc.end();

    } catch (err) {
        console.error('Error PDF:', err);
        res.status(500).json({ message: 'Gagal export PDF' });
    }
});

// ==========================================
// 2. EKSPOR EXCEL TAHUNAN (REVISI WARNA)
// ==========================================
// --- ENDPOINT EXPORT EXCEL TAHUNAN (FIXED) ---
app.get('/api/export/yearly', async (req, res) => {
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(YEAR FROM recorded_at) = $1
             ORDER BY recorded_at ASC`,
            [targetYear]
        );

        // --- DEFINISI WARNA (Sama dengan Bulanan) ---
        const colors = {
            kantor:     'FFADD8E6', // Biru
            parkir:     'FF90EE90', // Hijau Muda
            makan:      'FFFFA500', // Orange
            tunggu:     'FFFFFF00', // Kuning
            terkelola:  { header: 'FF32CD32', cell: 'FFE8F5E9' }, // Hijau Tua & Hijau Pucat
            residu:     { header: 'FFFF0000', cell: 'FFFFEBEE' }  // Merah & Merah Pucat
        };

        const areaList = [
            { name: 'Area Kantor', color: colors.kantor },
            { name: 'Area Parkir', color: colors.parkir },
            { name: 'Area Makan',  color: colors.makan },
            { name: 'Area Ruang Tunggu', color: colors.tunggu }
        ];

        // Struktur Item (Sama dengan Bulanan)
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
                { header: 'Kantong', keywords: ['kantong', 'kresek', 'semen'] } 
            ],
            residu: [
                { header: 'Drum Vat', keywords: ['drum', 'vat'] },
                { header: 'Residu', keywords: ['residu', 'lain'] }
            ]
        };

        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        // Inisialisasi Data
        const reportData = {};
        for (let m = 0; m < 12; m++) {
            reportData[m] = {};
            areaList.forEach(area => {
                reportData[m][area.name] = {};
                [...structure.organik, ...structure.anorganik, ...structure.residu].forEach(item => {
                    reportData[m][area.name][item.header] = 0;
                });
            });
        }

        // Mapping Data dari Database
        rows.forEach(row => {
            const dateObj = new Date(row.recorded_at);
            const monthIndex = dateObj.getMonth();
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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Tahun ${targetYear}`);

        // --- KONFIGURASI KOLOM (FIXED: 13 Kolom per Area) ---
        const colsPerArea = 13;
        const totalAreaCols = 2 + (colsPerArea * areaList.length);
        const finalTotalCols = totalAreaCols + 2;
        
        // Helper Huruf Excel
        const getColLetter = (n) => {
            let s = "";
            while (n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };
        const lastColLetter = getColLetter(finalTotalCols - 1);

        // Header Utama
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - TAHUN ${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        let currentIdx = 3;
        worksheet.getCell('A3').value = 'No'; worksheet.mergeCells('A3:A5');
        worksheet.getCell('B3').value = 'Bulan'; worksheet.mergeCells('B3:B5');

        // Loop Header Area
        const specialColsIndex = []; 

        areaList.forEach(area => {
            const startCol = currentIdx;
            const endCol = currentIdx + colsPerArea - 1;

            // 1. Header Nama Area
            worksheet.mergeCells(3, startCol, 3, endCol);
            const cellArea = worksheet.getCell(3, startCol);
            cellArea.value = area.name.toUpperCase();
            cellArea.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: area.color } };

            // 2. Sub Header (Kategori)
            // Organik
            worksheet.mergeCells(4, currentIdx, 4, currentIdx + 1);
            worksheet.getCell(4, currentIdx).value = 'Organik';
            worksheet.getCell(4, currentIdx + 2).value = 'Total Organik';

            // Anorganik
            const anorgStart = currentIdx + 3;
            worksheet.mergeCells(4, anorgStart, 4, anorgStart + 4);
            worksheet.getCell(4, anorgStart).value = 'Anorganik';
            worksheet.getCell(4, anorgStart + 5).value = 'Total Anorganik';
            
            // Total Terkelola Lokal
            const colTerkelolaLocal = anorgStart + 6; 
            worksheet.getCell(4, colTerkelolaLocal).value = 'Total Terkelola';
            specialColsIndex.push({ index: colTerkelolaLocal, type: 'terkelola' });

            // Residu & Tidak Terkelola
            const residuStart = anorgStart + 7;
            worksheet.mergeCells(4, residuStart, 4, residuStart + 1);
            worksheet.getCell(4, residuStart).value = 'Sampah Tidak Terkelola';
            
            const colResiduLocal = residuStart + 2;
            worksheet.getCell(4, colResiduLocal).value = 'Total Tidak Terkelola';
            specialColsIndex.push({ index: colResiduLocal, type: 'residu' });

            // 3. Item Headers (Baris 5)
            let subIdx = currentIdx;
            structure.organik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Sub Org
            structure.anorganik.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Sub Anorg
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Unit Total Terkelola
            structure.residu.forEach(i => { worksheet.getCell(5, subIdx++).value = i.header; });
            worksheet.getCell(5, subIdx++).value = '(Kg)'; // Unit Total Residu

            currentIdx += colsPerArea;
        });

        // Header Grand Total (Ujung Kanan)
        const colGrandTerkelola = totalAreaCols + 1;
        const colGrandTidakTerkelola = totalAreaCols + 2;

        worksheet.mergeCells(3, colGrandTerkelola, 5, colGrandTerkelola);
        const cellGT = worksheet.getCell(3, colGrandTerkelola);
        cellGT.value = "TOTAL SAMPAH TERKELOLA SETIAP AREA";
        cellGT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
        cellGT.font = { bold: true, size: 9 };
        cellGT.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        
        worksheet.mergeCells(3, colGrandTidakTerkelola, 5, colGrandTidakTerkelola);
        const cellGTT = worksheet.getCell(3, colGrandTidakTerkelola);
        cellGTT.value = "TOTAL SAMPAH TIDAK TERKELOLA SETIAP AREA";
        cellGTT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
        cellGTT.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cellGTT.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Global Style & Coloring
        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            row.height = 30;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = Object.assign({}, cell.font || {}, { bold: true, size: 9 });
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                
                // Pastikan border grand total tergambar
                if (colNumber > totalAreaCols && colNumber <= finalTotalCols) {
                     cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                }

                if (colNumber <= 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

                // Warnai Header Khusus per Area
                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol && r > 3) {
                    if (specialCol.type === 'terkelola') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                    } else if (specialCol.type === 'residu') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                }
            });
        }

        // Isi Data
        const grandTotalsFooter = new Array(finalTotalCols + 1).fill(0);

        for (let m = 0; m < 12; m++) {
            const rowValues = [m + 1, monthNames[m]];
            let monthlyGrandTerkelola = 0;
            let monthlyGrandTidakTerkelola = 0;

            areaList.forEach(area => {
                const r = reportData[m][area.name];
                let sumOrganik = 0; structure.organik.forEach(i => sumOrganik += (r[i.header] || 0));
                let sumAnorganik = 0; structure.anorganik.forEach(i => sumAnorganik += (r[i.header] || 0));
                let sumResidu = 0; structure.residu.forEach(i => sumResidu += (r[i.header] || 0));
                const totalTerkelolaArea = sumOrganik + sumAnorganik;

                monthlyGrandTerkelola += totalTerkelolaArea;
                monthlyGrandTidakTerkelola += sumResidu;

                structure.organik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumOrganik || '-');
                structure.anorganik.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumAnorganik || '-');
                rowValues.push(totalTerkelolaArea || '-'); // Kolom Terkelola Local
                structure.residu.forEach(i => rowValues.push(r[i.header] || '-'));
                rowValues.push(sumResidu || '-'); // Kolom Residu Local
            });

            rowValues.push(monthlyGrandTerkelola || '-');
            rowValues.push(monthlyGrandTidakTerkelola || '-');

            const excelRow = worksheet.getRow(m + 6);
            excelRow.values = rowValues;

            // Warnai Cell Data
            excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { horizontal: 'center' };

                const val = cell.value;
                if (typeof val === 'number') grandTotalsFooter[colNumber] = (grandTotalsFooter[colNumber] || 0) + val;

                // Warnai kolom spesial per area & Grand Total
                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol) {
                    if (specialCol.type === 'terkelola') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.cell } };
                    } else if (specialCol.type === 'residu') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.cell } };
                    }
                } 
                else if (colNumber === colGrandTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.cell } };
                } else if (colNumber === colGrandTidakTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.cell } };
                }
            });
        }

        // Footer
        const rowTotalKg = 12 + 6;
        const rowTotalTon = rowTotalKg + 1;
        const rowAvg = rowTotalKg + 2;

        worksheet.getCell(`A${rowTotalKg}`).value = 'Total (kg/thn)';
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total (ton/thn)';
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata (kg/hari)';
        const daysInYear = (targetYear % 4 === 0 && targetYear % 100 > 0) || targetYear % 400 === 0 ? 366 : 365;

        for (let c = 3; c <= finalTotalCols; c++) {
            const totalVal = grandTotalsFooter[c] || 0;
            
            const cellKg = worksheet.getCell(rowTotalKg, c);
            cellKg.value = totalVal;
            
            const cellTon = worksheet.getCell(rowTotalTon, c);
            cellTon.value = (totalVal / 1000);
            cellTon.numFmt = '0.000';
            
            const cellAvg = worksheet.getCell(rowAvg, c);
            cellAvg.value = (totalVal / daysInYear);
            cellAvg.numFmt = '0.00';
        }

        // Style Footer
        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const row = worksheet.getRow(r);
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { bold: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                const specialCol = specialColsIndex.find(s => s.index === colNumber);
                if (specialCol) {
                    if (specialCol.type === 'terkelola') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                    else if (specialCol.type === 'residu') {
                         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                         cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                } else if (colNumber === colGrandTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.terkelola.header } };
                } else if (colNumber === colGrandTidakTerkelola) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residu.header } };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                }
            });
        });

        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 15;
        for (let i = 3; i <= finalTotalCols; i++) {
            worksheet.getColumn(i).width = 17;
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Sampah_Tahunan_${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel Tahunan:', err);
        res.status(500).json({ message: 'Gagal export tahunan' });
    }
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Server BERHASIL berjalan di http://localhost:${PORT}`);
    });
}

module.exports = app;