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

// --- UPLOAD (VERCEL MODE + REALTIME TIMESTAMP) ---
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
                    
                    // --- PERBAIKAN WAKTU: GUNAKAN WAKTU SERVER SAAT INI ---
                    let recordedAt = new Date(); 
                    // ------------------------------------------------------

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
    res.json({ message: 'Upload berhasil. Data disimpan sesuai waktu upload.' });
  } catch (err) {
    console.error('System Error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan sistem.' });
  }
});

// --- HELPER TANGGAL (Asia/Jakarta) ---
function getSQLDateCondition(range, year, month, week, specificDate) {
  const jsDate = new Date(); 
  const local_timestamp = "recorded_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'";
  const targetYear = year ? parseInt(year) : jsDate.getFullYear();
  const targetMonth = month ? parseInt(month) : jsDate.getMonth() + 1; 
  
  // Pastikan bulan 2 digit
  const tm = targetMonth.toString().padStart(2, '0');
  
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

// --- STATISTIK (3 KATEGORI) ---
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
    res.json([
      { name: 'Organik', value: parseFloat(data.total_organik) },
      { name: 'Anorganik', value: parseFloat(data.total_anorganik) },
      { name: 'Tidak Terkelola', value: parseFloat(data.total_residu) }
    ]);
  } catch (err) {
    res.status(500).json({ message: 'Server error statistics.' });
  }
});

// --- RECORDS ---
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

        // --- HEADER & MERGE ---
        worksheet.mergeCells('A1:R1');
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - BULAN ${targetMonth}/${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

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

        ['A3', 'B3', 'C3', 'G3', 'K3', 'O3', 'S3'].forEach(cell => {
            worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            worksheet.getCell(cell).font = { bold: true };
            worksheet.getCell(cell).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // --- PENGATURAN LEBAR KOLOM (FIXED) ---
        worksheet.getColumn(1).width = 5; 
        worksheet.getColumn(2).width = 30; 
        for(let i=3; i<=19; i++) {
            worksheet.getColumn(i).width = 15;
        }

        for (let r = 4; r <= 5; r++) {
             worksheet.getRow(r).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }

        // Isi Data Harian
        for (let d = 1; d <= daysInMonth; d++) {
            const rowData = reportData[d];
            const rowNum = d + 5; 

            const k_org = rowData['Area Kantor'].organik; const k_ano = rowData['Area Kantor'].anorganik; const k_res = rowData['Area Kantor'].residu;
            const k_tot = k_org + k_ano + k_res;

            const p_org = rowData['Area Parkir'].organik; const p_ano = rowData['Area Parkir'].anorganik; const p_res = rowData['Area Parkir'].residu;
            const p_tot = p_org + p_ano + p_res;

            const m_org = rowData['Area Makan'].organik; const m_ano = rowData['Area Makan'].anorganik; const m_res = rowData['Area Makan'].residu;
            const m_tot = m_org + m_ano + m_res;

            const t_org = rowData['Area Ruang Tunggu'].organik; const t_ano = rowData['Area Ruang Tunggu'].anorganik; const t_res = rowData['Area Ruang Tunggu'].residu;
            const t_tot = t_org + t_ano + t_res;

            const dailyTotal = k_tot + p_tot + m_tot + t_tot;

            const row = worksheet.getRow(rowNum);
            row.values = [
                d, d,
                k_org, k_ano, k_res, k_tot,
                p_org, p_ano, p_res, p_tot,
                m_org, m_ano, m_res, m_tot,
                t_org, t_ano, t_res, t_tot,
                dailyTotal
            ];
        }

        // --- FOOTER (Total Kg, Ton, Rata-rata) ---
        const rowTotalKg = daysInMonth + 6; 
        worksheet.getCell(`A${rowTotalKg}`).value = 'Total/jenis (kg/bulan)';
        worksheet.mergeCells(`A${rowTotalKg}:B${rowTotalKg}`);
        worksheet.getCell(`A${rowTotalKg}`).font = { bold: true };
        worksheet.getCell(`A${rowTotalKg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowTotalKg}`).value = { formula: `SUM(${colLetter}6:${colLetter}${rowTotalKg-1})` };
            worksheet.getCell(`${colLetter}${rowTotalKg}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowTotalKg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
        }

        const rowTotalTon = rowTotalKg + 1; 
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total/jenis (ton/bulan)';
        worksheet.mergeCells(`A${rowTotalTon}:B${rowTotalTon}`);
        worksheet.getCell(`A${rowTotalTon}`).font = { bold: true };
        worksheet.getCell(`A${rowTotalTon}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCBC' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowTotalTon}`).value = { formula: `${colLetter}${rowTotalKg}/1000` };
            worksheet.getCell(`${colLetter}${rowTotalTon}`).numFmt = '0.000';
            worksheet.getCell(`${colLetter}${rowTotalTon}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowTotalTon}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCBC' } };
        }

        const rowAvg = rowTotalTon + 1; 
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata perhari (kg/hari)';
        worksheet.mergeCells(`A${rowAvg}:B${rowAvg}`);
        worksheet.getCell(`A${rowAvg}`).font = { bold: true };
        worksheet.getCell(`A${rowAvg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowAvg}`).value = { formula: `${colLetter}${rowTotalKg}/${daysInMonth}` };
            worksheet.getCell(`${colLetter}${rowAvg}`).numFmt = '0.00'; 
            worksheet.getCell(`${colLetter}${rowAvg}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowAvg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
        }

        // Border
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Lengkap_${targetMonth}-${targetYear}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error saat ekspor Excel:', err.message);
        res.status(500).json({ message: 'Gagal membuat file Excel.' });
    }
});

// --- RUTE EKSPOR TAHUNAN (FIX WIDTH & TOTAL) ---
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
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

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
            const monthIndex = dateObj.getMonth(); 
            
            let area = row.area_label ? row.area_label.trim() : '';
            const status = row.status ? row.status.trim() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            let targetAreaKey = null;
            if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
            else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
            else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
            else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

            if (targetAreaKey) {
                if (status === 'Organik Terpilah') reportData[monthIndex][targetAreaKey].organik += weight;
                else if (status === 'Anorganik Terpilah') reportData[monthIndex][targetAreaKey].anorganik += weight;
                else if (status === 'Tidak Terkelola') reportData[monthIndex][targetAreaKey].residu += weight;
            }
        });

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan Tahun ${targetYear}`);

        // --- FIX: SETTING LEBAR KOLOM ---
        for (let i = 3; i <= 19; i++) { // C - S
            worksheet.getColumn(i).width = 15;
        }
        worksheet.getColumn(1).width = 5;  
        worksheet.getColumn(2).width = 30; // Bulan

        // Header
        worksheet.mergeCells('A1:R1');
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - TAHUN ${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells('A3:A5'); worksheet.getCell('A3').value = 'No';
        worksheet.mergeCells('B3:B5'); worksheet.getCell('B3').value = 'Bulan';

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

        for (let r = 4; r <= 5; r++) {
             worksheet.getRow(r).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }

        for (let m = 0; m < 12; m++) {
            const rowData = reportData[m];
            const rowNum = m + 6; 

            const k_org = rowData['Area Kantor'].organik; const k_ano = rowData['Area Kantor'].anorganik; const k_res = rowData['Area Kantor'].residu;
            const k_tot = k_org + k_ano + k_res;

            const p_org = rowData['Area Parkir'].organik; const p_ano = rowData['Area Parkir'].anorganik; const p_res = rowData['Area Parkir'].residu;
            const p_tot = p_org + p_ano + p_res;

            const m_org = rowData['Area Makan'].organik; const m_ano = rowData['Area Makan'].anorganik; const m_res = rowData['Area Makan'].residu;
            const m_tot = m_org + m_ano + m_res;

            const t_org = rowData['Area Ruang Tunggu'].organik; const t_ano = rowData['Area Ruang Tunggu'].anorganik; const t_res = rowData['Area Ruang Tunggu'].residu;
            const t_tot = t_org + t_ano + t_res;

            const monthlyTotal = k_tot + p_tot + m_tot + t_tot;

            const row = worksheet.getRow(rowNum);
            row.values = [
                m + 1, monthNames[m], 
                k_org, k_ano, k_res, k_tot, 
                p_org, p_ano, p_res, p_tot, 
                m_org, m_ano, m_res, m_tot, 
                t_org, t_ano, t_res, t_tot, 
                monthlyTotal
            ];
        }

        // --- FOOTER ---
        const rowTotalKg = 12 + 6; 
        worksheet.getCell(`A${rowTotalKg}`).value = 'Total/jenis (kg/tahun)';
        worksheet.mergeCells(`A${rowTotalKg}:B${rowTotalKg}`);
        worksheet.getCell(`A${rowTotalKg}`).font = { bold: true };
        worksheet.getCell(`A${rowTotalKg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowTotalKg}`).value = { formula: `SUM(${colLetter}6:${colLetter}${rowTotalKg-1})` };
            worksheet.getCell(`${colLetter}${rowTotalKg}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowTotalKg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
        }

        const rowTotalTon = rowTotalKg + 1; 
        worksheet.getCell(`A${rowTotalTon}`).value = 'Total/jenis (ton/tahun)';
        worksheet.mergeCells(`A${rowTotalTon}:B${rowTotalTon}`);
        worksheet.getCell(`A${rowTotalTon}`).font = { bold: true };
        worksheet.getCell(`A${rowTotalTon}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCBC' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowTotalTon}`).value = { formula: `${colLetter}${rowTotalKg}/1000` };
            worksheet.getCell(`${colLetter}${rowTotalTon}`).numFmt = '0.000';
            worksheet.getCell(`${colLetter}${rowTotalTon}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowTotalTon}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCBC' } };
        }

        const daysInYear = (targetYear % 4 === 0 && targetYear % 100 > 0) || targetYear % 400 === 0 ? 366 : 365;

        const rowAvg = rowTotalTon + 1; 
        worksheet.getCell(`A${rowAvg}`).value = 'Rata-rata perhari (kg/hari)';
        worksheet.mergeCells(`A${rowAvg}:B${rowAvg}`);
        worksheet.getCell(`A${rowAvg}`).font = { bold: true };
        worksheet.getCell(`A${rowAvg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; 

        for(let col=3; col<=19; col++) {
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${rowAvg}`).value = { formula: `${colLetter}${rowTotalKg}/${daysInYear}` };
            worksheet.getCell(`${colLetter}${rowAvg}`).numFmt = '0.00'; 
            worksheet.getCell(`${colLetter}${rowAvg}`).font = { bold: true };
            worksheet.getCell(`${colLetter}${rowAvg}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
        }

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Tahunan_${targetYear}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error saat ekspor Tahunan:', err.message);
        res.status(500).json({ message: 'Gagal membuat file Excel.' });
    }
});

// --- EXPORT APP (VERCEL) ---
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}
module.exports = app;