require('dotenv').config(); // Untuk testing lokal
const express = require('express');
const cors = require('cors');
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
  ssl: { rejectUnauthorized: false } // Wajib untuk Neon
});

// --- 2. CONFIG MULTER (MEMORY STORAGE) ---
// Vercel tidak punya disk, file disimpan di RAM sementara
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors({
    origin: '*',
    methods: "GET,POST,DELETE",
    optionsSuccessStatus: 200
}));
app.use(express.json());

// Cek Status
app.get('/', (req, res) => {
    res.send('Green Backend is Running on Vercel!');
});

// --- LOGIN ---
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

// --- UPLOAD (VERCEL MODE: MEMORY + BOM FIX) ---
app.post('/api/upload', upload.array('csvFiles'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'Tidak ada file.' });

  const resultsSummary = { success: [], failed: [], totalRows: 0 };

  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      const rowData = [];
      
      // Baca dari BUFFER (RAM)
      Readable.from(file.buffer)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') // Fix BOM (karakter hantu)
        }))
        .on('data', (data) => rowData.push(data))
        .on('error', (err) => reject(err))
        .on('end', async () => {
            if (rowData.length === 0) return resolve({ status: 'error', file: file.originalname, reason: 'File kosong' });
            
            // Gunakan pool.connect untuk transaksi
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const row of rowData) {
                    // Fix Format Tanggal (DD/MM/YYYY -> Date Object)
                    let dateTimeString = row['Waktu Catat']?.replace(/"/g, '') || '';
                    dateTimeString = dateTimeString.replace('.', ':');
                    const parsableDateString = dateTimeString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'); 
                    let recordedAt = new Date(parsableDateString);
                    if (isNaN(recordedAt.getTime())) {
                         const isoDate = new Date(dateTimeString);
                         if (!isNaN(isoDate.getTime())) recordedAt = isoDate;
                    }

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
    const results = await Promise.all(promises);
    results.forEach(r => {
        if (r.status === 'success') {
            resultsSummary.success.push(r.file);
            resultsSummary.totalRows += r.count;
        } else {
            resultsSummary.failed.push(`${r.file} (${r.reason})`);
        }
    });
    let message = `Berhasil: ${resultsSummary.success.length} file (${resultsSummary.totalRows} data).`;
    if (resultsSummary.failed.length > 0) message += ` Gagal: ${resultsSummary.failed.join(', ')}`;
    res.json({ message, previewData: [] });
  } catch (err) {
    console.error('System Error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan sistem.' });
  }
});

// --- HELPER TANGGAL (Asia/Jakarta) ---
// --- HELPER TANGGAL (FIX TIMEZONE ASIA/JAKARTA) ---
// --- HELPER TANGGAL (UPDATE: Support Filter Tanggal Spesifik) ---
function getSQLDateCondition(range, year, month, week, specificDate) {
  const jsDate = new Date(); 
  const local_timestamp = "recorded_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'";
  const targetYear = year ? parseInt(year) : jsDate.getFullYear();
  const targetMonth = month ? parseInt(month) : jsDate.getMonth() + 1; 
  
  const dayOfMonth = jsDate.getDate();
  let currentWeekOfMonth = 1;
  if (dayOfMonth >= 8 && dayOfMonth <= 14) currentWeekOfMonth = 2;
  else if (dayOfMonth >= 15 && dayOfMonth <= 21) currentWeekOfMonth = 3;
  else if (dayOfMonth >= 22) currentWeekOfMonth = 4;
  const targetWeek = week ? parseInt(week) : currentWeekOfMonth;

  // Format Hari Ini (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  let dateCondition = '';

  switch (range) {
    case 'weekly':
      let startDateW, endDateW;
      if (targetWeek === 1) { startDateW = `'${targetYear}-${targetMonth}-01'`; endDateW = `'${targetYear}-${targetMonth}-07'`; }
      else if (targetWeek === 2) { startDateW = `'${targetYear}-${targetMonth}-08'`; endDateW = `'${targetYear}-${targetMonth}-14'`; }
      else if (targetWeek === 3) { startDateW = `'${targetYear}-${targetMonth}-15'`; endDateW = `'${targetYear}-${targetMonth}-21'`; }
      else { 
        startDateW = `'${targetYear}-${targetMonth}-22'`;
        const endDateW_SQL = `(DATE_TRUNC('MONTH',TO_DATE('${targetYear}-${targetMonth}-01','YYYY-MM-DD')) + INTERVAL '1 MONTH' - INTERVAL '1 DAY')::DATE`;
        dateCondition = `DATE(${local_timestamp}) >= '${startDateW}' AND DATE(${local_timestamp}) <= ${endDateW_SQL}`;
        break; 
      }
      dateCondition = `DATE(${local_timestamp}) BETWEEN '${startDateW}' AND '${endDateW}'`;
      break;

    case 'monthly':
      dateCondition = `EXTRACT(MONTH FROM ${local_timestamp}) = ${targetMonth} AND EXTRACT(YEAR FROM ${local_timestamp}) = ${targetYear}`;
      break;

    case 'yearly':
      dateCondition = `EXTRACT(YEAR FROM ${local_timestamp}) = ${targetYear}`;
      break;

    default: // 'daily'
      // JIKA ADA TANGGAL SPESIFIK DIPILIH, PAKAI ITU. JIKA TIDAK, PAKAI HARI INI.
      if (specificDate) {
          dateCondition = `DATE(${local_timestamp}) = '${specificDate}'`;
      } else {
          dateCondition = `DATE(${local_timestamp}) = '${today}'`;
      }
  }
  return dateCondition;
}

// --- UPDATE ROUTE STATISTIK (Terima param 'date') ---
app.get('/api/stats', async (req, res) => {
  const { range, year, month, week, date } = req.query; // Tambah 'date'
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
    res.json([
      { name: 'Organik', value: parseFloat(data.total_organik) },
      { name: 'Anorganik', value: parseFloat(data.total_anorganik) },
      { name: 'Tidak Terkelola', value: parseFloat(data.total_residu) }
    ]);
  } catch (err) { res.status(500).json({ message: 'Error stats' }); }
});

// --- UPDATE ROUTE RECORDS (Terima param 'date') ---
app.get('/api/records', async (req, res) => {
  const { range, year, month, week, date } = req.query; // Tambah 'date'
  try {
    const dateCondition = getSQLDateCondition(range, year, month, week, date);
    const query = `
      SELECT area_label, item_label, pengelola, status, weight_kg, petugas_name, recorded_at
      FROM waste_records WHERE ${dateCondition} ORDER BY recorded_at DESC;
    `;
    const recordsQuery = await pool.query(query);
    res.json(recordsQuery.rows);
  } catch (err) { res.status(500).json({ message: 'Error records' }); }
});

// --- HAPUS DATA ---
app.delete('/api/clear-data', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE waste_records RESTART IDENTITY;');
        res.json({ message: 'Data dihapus.' });
    } catch (err) { res.status(500).json({ message: 'Error delete' }); }
});

// --- EKSPOR BULANAN (MATRIKS + FOOTER LENGKAP) ---
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

        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const reportData = {};

        for (let d = 1; d <= daysInMonth; d++) {
            reportData[d] = {
                'Area Kantor': { organik: 0, anorganik: 0, residu: 0 },
                'Area Parkir': { organik: 0, anorganik: 0, residu: 0 },
                'Area Makan': { organik: 0, anorganik: 0, residu: 0 },
                'Area Ruang Tunggu': { organik: 0, anorganik: 0, residu: 0 },
            };
        }

        rows.forEach(row => {
            const dateObj = new Date(row.recorded_at);
            const day = dateObj.getDate();
            let area = row.area_label ? row.area_label.trim() : '';
            const status = row.status ? row.status.trim() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            let targetAreaKey = null;
            if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
            else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
            else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
            else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

            if (targetAreaKey && reportData[day]) {
                if (status === 'Organik Terpilah') reportData[day][targetAreaKey].organik += weight;
                else if (status === 'Anorganik Terpilah') reportData[day][targetAreaKey].anorganik += weight;
                else if (status === 'Tidak Terkelola') reportData[day][targetAreaKey].residu += weight;
            }
        });

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan ${targetMonth}-${targetYear}`);

        // Set Lebar Kolom Manual
        for (let i = 3; i <= 19; i++) { worksheet.getColumn(i).width = 15; }
        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 30;

        // Header
        worksheet.mergeCells('A1:R1'); worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - BULAN ${targetMonth}/${targetYear}`;
        worksheet.mergeCells('A3:A5'); worksheet.getCell('A3').value = 'No';
        worksheet.mergeCells('B3:B5'); worksheet.getCell('B3').value = 'Tanggal';

        worksheet.mergeCells('C3:F3'); worksheet.getCell('C3').value = 'Area Kantor';
        worksheet.getCell('C4').value = 'Sampah'; worksheet.getCell('D4').value = 'Sampah'; worksheet.getCell('E4').value = 'Sampah'; worksheet.getCell('F4').value = 'Total';
        worksheet.getCell('C5').value = 'Organik'; worksheet.getCell('D5').value = 'Anorganik'; worksheet.getCell('E5').value = 'Lainnya'; worksheet.getCell('F5').value = '(Kg)';

        worksheet.mergeCells('G3:J3'); worksheet.getCell('G3').value = 'Area Parkir';
        worksheet.getCell('G4').value = 'Sampah'; worksheet.getCell('H4').value = 'Sampah'; worksheet.getCell('I4').value = 'Sampah'; worksheet.getCell('J4').value = 'Total';
        worksheet.getCell('G5').value = 'Organik'; worksheet.getCell('H5').value = 'Anorganik'; worksheet.getCell('I5').value = 'Lainnya'; worksheet.getCell('J5').value = '(Kg)';

        worksheet.mergeCells('K3:N3'); worksheet.getCell('K3').value = 'Area Makan';
        worksheet.getCell('K4').value = 'Sampah'; worksheet.getCell('L4').value = 'Sampah'; worksheet.getCell('M4').value = 'Sampah'; worksheet.getCell('N4').value = 'Total';
        worksheet.getCell('K5').value = 'Organik'; worksheet.getCell('L5').value = 'Anorganik'; worksheet.getCell('M5').value = 'Lainnya'; worksheet.getCell('N5').value = '(Kg)';

        worksheet.mergeCells('O3:R3'); worksheet.getCell('O3').value = 'Area Ruang Tunggu';
        worksheet.getCell('O4').value = 'Sampah'; worksheet.getCell('P4').value = 'Sampah'; worksheet.getCell('Q4').value = 'Sampah'; worksheet.getCell('R4').value = 'Total';
        worksheet.getCell('O5').value = 'Organik'; worksheet.getCell('P5').value = 'Anorganik'; worksheet.getCell('Q5').value = 'Lainnya'; worksheet.getCell('R5').value = '(Kg)';

        worksheet.mergeCells('S3:S5'); worksheet.getCell('S3').value = 'TOTAL HARIAN (Kg)';

        // Styling Header
        ['A3','B3','C3','G3','K3','O3','S3'].forEach(c => {
             const cell = worksheet.getCell(c);
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
             cell.font = { bold: true };
             cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        // Styling Subheader
        for (let r = 4; r <= 5; r++) { worksheet.getRow(r).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; }

        // Isi Data
        for (let d = 1; d <= daysInMonth; d++) {
            const r = reportData[d];
            const kt = r['Area Kantor'].organik + r['Area Kantor'].anorganik + r['Area Kantor'].residu;
            const pt = r['Area Parkir'].organik + r['Area Parkir'].anorganik + r['Area Parkir'].residu;
            const mt = r['Area Makan'].organik + r['Area Makan'].anorganik + r['Area Makan'].residu;
            const tt = r['Area Ruang Tunggu'].organik + r['Area Ruang Tunggu'].anorganik + r['Area Ruang Tunggu'].residu;
            const dt = kt + pt + mt + tt;

            const row = worksheet.getRow(d + 5);
            row.values = [ d, d, 
                r['Area Kantor'].organik, r['Area Kantor'].anorganik, r['Area Kantor'].residu, kt,
                r['Area Parkir'].organik, r['Area Parkir'].anorganik, r['Area Parkir'].residu, pt,
                r['Area Makan'].organik, r['Area Makan'].anorganik, r['Area Makan'].residu, mt,
                r['Area Ruang Tunggu'].organik, r['Area Ruang Tunggu'].anorganik, r['Area Ruang Tunggu'].residu, tt,
                dt 
            ];
        }

        // Footer
        const rowTotalKg = daysInMonth + 6; 
        worksheet.getCell(`A${rowTotalKg}`).value = 'Total/jenis (kg/bulan)';
        worksheet.mergeCells(`A${rowTotalKg}:B${rowTotalKg}`);
        
        const rowTotalTon = rowTotalKg + 1; 
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total/jenis (ton/bulan)';
        worksheet.mergeCells(`A${rowTotalTon}:B${rowTotalTon}`);
        
        const rowAvg = rowTotalTon + 1; 
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata perhari (kg/hari)';
        worksheet.mergeCells(`A${rowAvg}:B${rowAvg}`);

        for(let col=3; col<=19; col++) {
            const l = worksheet.getColumn(col).letter;
            worksheet.getCell(`${l}${rowTotalKg}`).value = { formula: `SUM(${l}6:${l}${rowTotalKg-1})` };
            worksheet.getCell(`${l}${rowTotalTon}`).value = { formula: `${l}${rowTotalKg}/1000` };
            worksheet.getCell(`${l}${rowTotalTon}`).numFmt = '0.000';
            worksheet.getCell(`${l}${rowAvg}`).value = { formula: `${l}${rowTotalKg}/${daysInMonth}` };
            worksheet.getCell(`${l}${rowAvg}`).numFmt = '0.00';
        }
        
        // Styling Footer
        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const cellA = worksheet.getCell(`A${r}`);
            cellA.font = { bold: true };
            cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
            for(let c=3; c<=19; c++) {
                const cell = worksheet.getCell(`${worksheet.getColumn(c).letter}${r}`);
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (r === rowTotalTon ? 'FFFFCCBC' : 'FFFFE0B2') } };
            }
        });

        // Borders
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Bulanan.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error export.' });
    }
});

// --- EKSPOR TAHUNAN (MATRIKS BULANAN) ---
app.get('/api/export/yearly', async (req, res) => {
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        const { rows } = await pool.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(YEAR FROM recorded_at) = $1
             ORDER BY recorded_at ASC`,
            [targetYear]
        );

        const reportData = {};
        const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

        for (let m = 0; m < 12; m++) {
            reportData[m] = {
                'Area Kantor': { organik: 0, anorganik: 0, residu: 0 },
                'Area Parkir': { organik: 0, anorganik: 0, residu: 0 },
                'Area Makan': { organik: 0, anorganik: 0, residu: 0 },
                'Area Ruang Tunggu': { organik: 0, anorganik: 0, residu: 0 },
            };
        }

        rows.forEach(row => {
            const dateObj = new Date(row.recorded_at);
            const m = dateObj.getMonth();
            let area = row.area_label ? row.area_label.trim() : '';
            const status = row.status ? row.status.trim() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            let targetAreaKey = null;
            if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
            else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
            else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
            else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

            if (targetAreaKey) {
                if (status === 'Organik Terpilah') reportData[m][targetAreaKey].organik += weight;
                else if (status === 'Anorganik Terpilah') reportData[m][targetAreaKey].anorganik += weight;
                else if (status === 'Tidak Terkelola') reportData[m][targetAreaKey].residu += weight;
            }
        });

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Tahun ${targetYear}`);

        // Columns Width
        for (let i = 3; i <= 19; i++) { worksheet.getColumn(i).width = 15; }
        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 30;

        // Header (Sama dengan Bulanan, ganti text Tanggal jadi Bulan)
        worksheet.mergeCells('A1:R1'); worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - TAHUN ${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells('A3:A5'); worksheet.getCell('A3').value = 'No';
        worksheet.mergeCells('B3:B5'); worksheet.getCell('B3').value = 'Bulan';

        // Header Areas (Sama persis)
        worksheet.mergeCells('C3:F3'); worksheet.getCell('C3').value = 'Area Kantor';
        worksheet.getCell('C4').value = 'Sampah'; worksheet.getCell('D4').value = 'Sampah'; worksheet.getCell('E4').value = 'Sampah'; worksheet.getCell('F4').value = 'Total';
        worksheet.getCell('C5').value = 'Organik'; worksheet.getCell('D5').value = 'Anorganik'; worksheet.getCell('E5').value = 'Lainnya'; worksheet.getCell('F5').value = '(Kg)';

        worksheet.mergeCells('G3:J3'); worksheet.getCell('G3').value = 'Area Parkir';
        worksheet.getCell('G4').value = 'Sampah'; worksheet.getCell('H4').value = 'Sampah'; worksheet.getCell('I4').value = 'Sampah'; worksheet.getCell('J4').value = 'Total';
        worksheet.getCell('G5').value = 'Organik'; worksheet.getCell('H5').value = 'Anorganik'; worksheet.getCell('I5').value = 'Lainnya'; worksheet.getCell('J5').value = '(Kg)';

        worksheet.mergeCells('K3:N3'); worksheet.getCell('K3').value = 'Area Makan';
        worksheet.getCell('K4').value = 'Sampah'; worksheet.getCell('L4').value = 'Sampah'; worksheet.getCell('M4').value = 'Sampah'; worksheet.getCell('N4').value = 'Total';
        worksheet.getCell('K5').value = 'Organik'; worksheet.getCell('L5').value = 'Anorganik'; worksheet.getCell('M5').value = 'Lainnya'; worksheet.getCell('N5').value = '(Kg)';

        worksheet.mergeCells('O3:R3'); worksheet.getCell('O3').value = 'Area Ruang Tunggu';
        worksheet.getCell('O4').value = 'Sampah'; worksheet.getCell('P4').value = 'Sampah'; worksheet.getCell('Q4').value = 'Sampah'; worksheet.getCell('R4').value = 'Total';
        worksheet.getCell('O5').value = 'Organik'; worksheet.getCell('P5').value = 'Anorganik'; worksheet.getCell('Q5').value = 'Lainnya'; worksheet.getCell('R5').value = '(Kg)';

        worksheet.mergeCells('S3:S5'); worksheet.getCell('S3').value = 'TOTAL BULANAN (Kg)';

        ['A3', 'B3', 'C3', 'G3', 'K3', 'O3', 'S3'].forEach(cell => {
            worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            worksheet.getCell(cell).font = { bold: true };
            worksheet.getCell(cell).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        for (let r = 4; r <= 5; r++) { worksheet.getRow(r).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; }

        // Isi Data (Loop 0-11)
        for (let m = 0; m < 12; m++) {
            const r = reportData[m];
            const kt = r['Area Kantor'].organik + r['Area Kantor'].anorganik + r['Area Kantor'].residu;
            const pt = r['Area Parkir'].organik + r['Area Parkir'].anorganik + r['Area Parkir'].residu;
            const mt = r['Area Makan'].organik + r['Area Makan'].anorganik + r['Area Makan'].residu;
            const tt = r['Area Ruang Tunggu'].organik + r['Area Ruang Tunggu'].anorganik + r['Area Ruang Tunggu'].residu;
            const dt = kt + pt + mt + tt;

            const row = worksheet.getRow(m + 6);
            row.values = [ m + 1, monthNames[m], 
                r['Area Kantor'].organik, r['Area Kantor'].anorganik, r['Area Kantor'].residu, kt,
                r['Area Parkir'].organik, r['Area Parkir'].anorganik, r['Area Parkir'].residu, pt,
                r['Area Makan'].organik, r['Area Makan'].anorganik, r['Area Makan'].residu, mt,
                r['Area Ruang Tunggu'].organik, r['Area Ruang Tunggu'].anorganik, r['Area Ruang Tunggu'].residu, tt,
                dt 
            ];
        }

        // Footer
        const rowTotalKg = 12 + 6; 
        worksheet.getCell(`A${rowTotalKg}`).value = 'Total/jenis (kg/tahun)';
        worksheet.mergeCells(`A${rowTotalKg}:B${rowTotalKg}`);
        const rowTotalTon = rowTotalKg + 1; 
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total/jenis (ton/tahun)';
        worksheet.mergeCells(`A${rowTotalTon}:B${rowTotalTon}`);
        const rowAvg = rowTotalTon + 1; 
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata perhari (kg/hari)';
        worksheet.mergeCells(`A${rowAvg}:B${rowAvg}`);

        const daysInYear = (targetYear % 4 === 0 && targetYear % 100 > 0) || targetYear % 400 === 0 ? 366 : 365;

        for(let col=3; col<=19; col++) {
            const l = worksheet.getColumn(col).letter;
            worksheet.getCell(`${l}${rowTotalKg}`).value = { formula: `SUM(${l}6:${l}${rowTotalKg-1})` };
            worksheet.getCell(`${l}${rowTotalTon}`).value = { formula: `${l}${rowTotalKg}/1000` };
            worksheet.getCell(`${l}${rowTotalTon}`).numFmt = '0.000';
            worksheet.getCell(`${l}${rowAvg}`).value = { formula: `${l}${rowTotalKg}/${daysInYear}` };
            worksheet.getCell(`${l}${rowAvg}`).numFmt = '0.00';
        }

        [rowTotalKg, rowTotalTon, rowAvg].forEach(r => {
            const cellA = worksheet.getCell(`A${r}`);
            cellA.font = { bold: true };
            cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
            for(let c=3; c<=19; c++) {
                const cell = worksheet.getCell(`${worksheet.getColumn(c).letter}${r}`);
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (r === rowTotalTon ? 'FFFFCCBC' : 'FFFFE0B2') } };
            }
        });

        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Tahunan.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error export.' });
    }
});

// --- EXPORT APP ---
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}
module.exports = app;