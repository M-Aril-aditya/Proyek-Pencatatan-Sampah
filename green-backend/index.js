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

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. KONEKSI DATABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. CONFIG MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 3. MIDDLEWARE ---
// --- UPDATE BAGIAN INI DI INDEX.JS ---
app.use(cors({
    origin: '*', // Mengizinkan akses dari semua domain (Web & Mobile)
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Pastikan DELETE dan PUT ada di sini!
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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
        const result = await pool.query('SELECT id, username FROM petugas ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Gagal mengambil data petugas' });
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

// --- TAMBAHKAN/PASTIKAN KODE INI ADA DI INDEX.JS ---

// 1. Route DELETE Petugas (Pastikan ini ada)
app.delete('/api/petugas/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Hapus data petugas berdasarkan ID
    await pool.query('DELETE FROM petugas WHERE id = $1', [id]);
    res.json({ message: 'Petugas berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menghapus petugas' });
  }
});

// 2. Route UPDATE Password Petugas (Fitur Baru)
app.put('/api/petugas/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'Password baru wajib diisi' });
    }

    // Enkripsi password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update database
    await pool.query('UPDATE petugas SET password = $1 WHERE id = $2', [hashedPassword, id]);
    
    res.json({ message: 'Password berhasil diperbarui' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengupdate password' });
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

app.get('/api/records', async (req, res) => {
  const { range, year, month, week, date } = req.query;
  try {
    const dateCondition = getSQLDateCondition(range, year, month, week, date);
    const query = `
      SELECT area_label, item_label, pengelola, status, weight_kg, petugas_name, recorded_at
      FROM waste_records WHERE ${dateCondition} ORDER BY recorded_at DESC;
    `;
    const recordsQuery = await pool.query(query);
    res.json(recordsQuery.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error records.' });
  }
});

// --- F. HAPUS DATA ---
app.delete('/api/clear-data', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE waste_records RESTART IDENTITY;');
        res.json({ message: 'Data dihapus.' });
    } catch (err) { res.status(500).json({ message: 'Error delete' }); }
});

// --- G. EKSPOR EXCEL BULANAN ---
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

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan ${targetMonth}-${targetYear}`);

        const colsPerArea = 15;
        const totalCols = 2 + (colsPerArea * areaList.length);

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

        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            row.height = 30; 
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

        const grandTotals = new Array(totalCols + 1).fill(0);

        for (let d = 1; d <= daysInMonth; d++) {
            const rowValues = [d, d];
            areaList.forEach(area => {
                const r = reportData[d][area];
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

        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 8; 
        for(let i=3; i<=totalCols; i++) {
            worksheet.getColumn(i).width = 17; 
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan Sampah Bulan ${targetMonth}-${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel:', err);
        res.status(500).json({ message: 'Gagal export excel' });
    }
});

// --- H. EKSPOR EXCEL TAHUNAN ---
app.get('/api/export/yearly', async (req, res) => {
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(YEAR FROM recorded_at) = $1
             ORDER BY recorded_at ASC`,
            [targetYear]
        );

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

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Tahun ${targetYear}`);

        const colsPerArea = 15;
        const totalCols = 2 + (colsPerArea * areaList.length);

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
        worksheet.getCell('B3').value = 'Bulan'; worksheet.mergeCells('B3:B5'); 

        areaList.forEach(area => {
            const startCol = currentIdx;
            const endCol = currentIdx + colsPerArea - 1;
            worksheet.mergeCells(3, startCol, 3, endCol);
            worksheet.getCell(3, startCol).value = area.toUpperCase();
            
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

        for (let r = 3; r <= 5; r++) {
            const row = worksheet.getRow(r);
            row.height = 30; 
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

        const grandTotals = new Array(totalCols + 1).fill(0);

        for (let m = 0; m < 12; m++) {
            const rowValues = [m + 1, monthNames[m]]; 
            
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

        const rowTotalKg = 12 + 6; 
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

        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 15; 
        for(let i=3; i<=totalCols; i++) {
            worksheet.getColumn(i).width = 17; 
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan Sampah Tahunan ${targetYear}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error Excel Tahunan:', err);
        res.status(500).json({ message: 'Gagal export tahunan' });
    }
});

// --- SERVER LISTEN ---
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}
module.exports = app;