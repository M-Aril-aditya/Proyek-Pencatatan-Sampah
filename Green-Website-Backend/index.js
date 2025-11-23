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

// Rute Login (TIDAK BERUBAH)
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

// --- (PERUBAHAN) Rute Upload ---
app.post('/api/upload', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File tidak ditemukan.' });
  }

  // --- DI DALAM RUTE app.post('/api/upload') ---

  // ... kode sebelumnya (if !req.file dll) ...

  const filePath = req.file.path;
  const results = [];
  
  // --- GANTI BLOK INI ---
  fs.createReadStream(filePath)
    .pipe(csv({
        // TAMBAHAN PENTING: Bersihkan karakter BOM dari header CSV
        mapHeaders: ({ header, index }) => {
            return header.trim().replace(/^\uFEFF/, '');
        }
    })) 
    .on('data', (data) => results.push(data))
    .on('end', async () => {
        // ... (Sisa kode di bawahnya TETAP SAMA, tidak perlu diubah) ...
      if (results.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: 'File CSV kosong atau format salah.' });
      }
      
      try {
        await db.query('BEGIN'); // Mulai transaksi

        for (const row of results) {
          // Logika tanggal (TIDAK BERUBAH)
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
          
          // --- (KUERI INSERT DIPERBARUI) ---
          // Kolom disesuaikan: pengelola & status DITAMBAHKAN
          const queryText = `
            INSERT INTO waste_records 
              (area_label, item_label, pengelola, status, weight_kg, petugas_name, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          const values = [
            row['Area'],
            row['Nama Item'],
            row['Pengelola'], // <-- KOLOM BARU DARI CSV
            row['Status'],    // <-- KOLOM BARU DARI CSV
            parseFloat(row['Bobot (Kg)']) || 0,
            row['Petugas'],
            recordedAt
          ];
          // ------------------------------------
          
          await db.query(queryText, values);
        }
        
        await db.query('COMMIT');
        console.log('Data (BARU) berhasil disimpan ke database PostgreSQL.');
        
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
// (TIDAK BERUBAH)
function getSQLDateCondition(range, year, month, week) {
  let dateCondition = '';
  const jsDate = new Date(); 
  
  const targetYear = year ? parseInt(year) : jsDate.getFullYear();
  const targetMonth = month ? parseInt(month) : jsDate.getMonth() + 1; // 1-12
  const targetWeek = week ? parseInt(week) : 1;

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  switch (range) {
    case 'weekly':
      let startDateW, endDateW;
      if (targetWeek === 1) { startDateW = `'${targetYear}-${targetMonth}-01'`; endDateW = `'${targetYear}-${targetMonth}-07'`; }
      else if (targetWeek === 2) { startDateW = `'${targetYear}-${targetMonth}-08'`; endDateW = `'${targetYear}-${targetMonth}-14'`; }
      else if (targetWeek === 3) { startDateW = `'${targetYear}-${targetMonth}-15'`; endDateW = `'${targetYear}-${targetMonth}-21'`; }
      else { // week 4
        startDateW = `'${targetYear}-${targetMonth}-22'`;
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
      const today = formatDate(jsDate); 
      dateCondition = `DATE(recorded_at) = '${today}'`;
  }
  return dateCondition;
}
// ===========================================

// === (PERUBAHAN) RUTE STATISTIK ===
// === UPDATE RUTE STATISTIK (MENGHITUNG 3 KATEGORI) ===
app.get('/api/stats', async (req, res) => {
  const { range, year, month, week } = req.query;
  
  try {
    const dateCondition = getSQLDateCondition(range, year, month, week);

    // --- QUERY BARU: MENGHITUNG 3 KATEGORI ---
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'Organik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_organik,
        COALESCE(SUM(CASE WHEN status = 'Anorganik Terpilah' THEN weight_kg ELSE 0 END), 0) as total_anorganik,
        COALESCE(SUM(CASE WHEN status = 'Tidak Terkelola' THEN weight_kg ELSE 0 END), 0) as total_residu
      FROM 
        waste_records 
      WHERE 
        ${dateCondition};
    `;
    // -----------------------------------------
    
    const statsQuery = await db.query(query);
    const data = statsQuery.rows[0];

    // Format data agar mudah dibaca Frontend
    const pieData = [
      { name: 'Organik', value: parseFloat(data.total_organik) },
      { name: 'Anorganik', value: parseFloat(data.total_anorganik) },
      { name: 'Tidak Terkelola', value: parseFloat(data.total_residu) }
    ];
    
    res.json(pieData);

  } catch (err) {
    console.error(`Error saat mengambil statistik:`, err.message);
    res.status(500).json({ message: 'Server error saat mengambil statistik.' });
  }
});
// === (PERUBAHAN) RUTE DATA MENTAH ===
app.get('/api/records', async (req, res) => {
  const { range, year, month, week } = req.query;

  try {
    const dateCondition = getSQLDateCondition(range, year, month, week);

    // --- (KUERI SELECT DIPERBARUI) ---
    // Menampilkan 'pengelola' dan 'status'
    const query = `
      SELECT 
        area_label, 
        item_label, 
        pengelola, 
        status, 
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
    // ------------------------------------
    
    const recordsQuery = await db.query(query);
    res.json(recordsQuery.rows);

  } catch (err) {
    console.error(`Error saat mengambil data records:`, err.message);
    res.status(500).json({ message: 'Server error saat mengambil data.' });
  }
});

// Rute Hapus Data (TIDAK BERUBAH)
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

// --- (PERUBAHAN) Rute Ekspor Excel ---
// --- REVISI TOTAL RUTE EKSPOR BULANAN (SESUAI FORMAT LAPORAN) ---
app.get('/api/export/monthly', async (req, res) => {
    const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    try {
        // 1. Ambil data mentah dari database
        const { rows } = await db.query(
            `SELECT * FROM waste_records 
             WHERE EXTRACT(MONTH FROM recorded_at) = $1 AND EXTRACT(YEAR FROM recorded_at) = $2
             ORDER BY recorded_at ASC`,
            [targetMonth, targetYear]
        );

        // 2. Siapkan Struktur Data Matriks (Tanggal 1 - 31)
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate(); // Cek jumlah hari dalam bulan tsb
        const reportData = {};

        // Inisialisasi objek kosong untuk setiap tanggal
        for (let d = 1; d <= daysInMonth; d++) {
            reportData[d] = {
                'Area Kantor': { organik: 0, anorganik: 0, residu: 0 },
                'Area Parkir': { organik: 0, anorganik: 0, residu: 0 },
                'Area Makan': { organik: 0, anorganik: 0, residu: 0 },
                'Area Ruang Tunggu': { organik: 0, anorganik: 0, residu: 0 }, // Sesuaikan nama area dengan Mobile
            };
        }

        // 3. Isi Data ke dalam Matriks (Looping data database)
        // ... (Bagian atas kode export monthly sama) ...

        // 3. Isi Data ke dalam Matriks (VERSI PERBAIKAN & DEBUGGING)
        rows.forEach(row => {
            const dateObj = new Date(row.recorded_at);
            const day = dateObj.getDate(); // Tanggal 1-31
            
            // Normalisasi Nama Area (Hapus spasi berlebih, samakan format)
            let area = row.area_label ? row.area_label.trim() : '';
            
            // Normalisasi Status
            const status = row.status ? row.status.trim() : '';
            const weight = parseFloat(row.weight_kg) || 0;

            // DEBUG: Cek data yang masuk di terminal
            console.log(`Processing: Tgl=${day}, Area='${area}', Status='${status}', Berat=${weight}`);

            // Pastikan hari ada di reportData
            if (reportData[day]) {
                // Cek apakah area ada di object reportData[day]
                // Jika nama area dari mobile berbeda sedikit, kita map manual agar aman
                let targetAreaKey = null;

                if (area.toLowerCase().includes('kantor')) targetAreaKey = 'Area Kantor';
                else if (area.toLowerCase().includes('parkir')) targetAreaKey = 'Area Parkir';
                else if (area.toLowerCase().includes('makan')) targetAreaKey = 'Area Makan';
                else if (area.toLowerCase().includes('tunggu')) targetAreaKey = 'Area Ruang Tunggu';

                if (targetAreaKey) {
                    // Logika Pengelompokan Status
                    if (status === 'Organik Terpilah') {
                        reportData[day][targetAreaKey].organik += weight;
                    } else if (status === 'Anorganik Terpilah') {
                        reportData[day][targetAreaKey].anorganik += weight;
                    } else if (status === 'Tidak Terkelola') { 
                        reportData[day][targetAreaKey].residu += weight;
                    } else {
                        console.log(`Status tidak dikenali: ${status}`); // Debug jika status beda
                    }
                } else {
                    console.log(`Area tidak dikenali: ${area}`); // Debug jika area beda
                }
            }
        });

        // ... (Sisa kode pembuatan Excel ke bawah TETAP SAMA) ...

        // 4. Buat File Excel dengan ExcelJS
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan ${targetMonth}-${targetYear}`);

        // --- STYLING HEADER (MENGIKUTI GAMBAR) ---
        
        // Baris 1: Judul
        worksheet.mergeCells('A1:R1');
        worksheet.getCell('A1').value = `REKAMAN TIMBULAN SAMPAH - BULAN ${targetMonth}/${targetYear}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Baris 2-4: Header Kompleks
        // Kolom No & Tanggal
        worksheet.mergeCells('A3:A5'); worksheet.getCell('A3').value = 'No';
        worksheet.mergeCells('B3:B5'); worksheet.getCell('B3').value = 'Tanggal';

        // Header Area Kantor (Kolom C-F)
        worksheet.mergeCells('C3:F3'); worksheet.getCell('C3').value = 'Area Kantor';
        worksheet.getCell('C4').value = 'Sampah'; worksheet.getCell('D4').value = 'Sampah'; worksheet.getCell('E4').value = 'Sampah'; worksheet.getCell('F4').value = 'Total';
        worksheet.getCell('C5').value = 'Organik'; worksheet.getCell('D5').value = 'Anorganik'; worksheet.getCell('E5').value = 'Lainnya'; worksheet.getCell('F5').value = '(Kg)';

        // Header Area Parkir (Kolom G-J)
        worksheet.mergeCells('G3:J3'); worksheet.getCell('G3').value = 'Area Parkir';
        worksheet.getCell('G4').value = 'Sampah'; worksheet.getCell('H4').value = 'Sampah'; worksheet.getCell('I4').value = 'Sampah'; worksheet.getCell('J4').value = 'Total';
        worksheet.getCell('G5').value = 'Organik'; worksheet.getCell('H5').value = 'Anorganik'; worksheet.getCell('I5').value = 'Lainnya'; worksheet.getCell('J5').value = '(Kg)';

        // Header Area Makan (Kolom K-N)
        worksheet.mergeCells('K3:N3'); worksheet.getCell('K3').value = 'Area Makan';
        worksheet.getCell('K4').value = 'Sampah'; worksheet.getCell('L4').value = 'Sampah'; worksheet.getCell('M4').value = 'Sampah'; worksheet.getCell('N4').value = 'Total';
        worksheet.getCell('K5').value = 'Organik'; worksheet.getCell('L5').value = 'Anorganik'; worksheet.getCell('M5').value = 'Lainnya'; worksheet.getCell('N5').value = '(Kg)';

        // Header Area Ruang Tunggu (Kolom O-R)
        worksheet.mergeCells('O3:R3'); worksheet.getCell('O3').value = 'Area Ruang Tunggu';
        worksheet.getCell('O4').value = 'Sampah'; worksheet.getCell('P4').value = 'Sampah'; worksheet.getCell('Q4').value = 'Sampah'; worksheet.getCell('R4').value = 'Total';
        worksheet.getCell('O5').value = 'Organik'; worksheet.getCell('P5').value = 'Anorganik'; worksheet.getCell('Q5').value = 'Lainnya'; worksheet.getCell('R5').value = '(Kg)';

        // Header Total Harian (Kolom S)
        worksheet.mergeCells('S3:S5'); worksheet.getCell('S3').value = 'TOTAL HARIAN (Kg)';

        // Styling Header (Kuning, Bold, Border, Center)
        ['A3', 'B3', 'C3', 'G3', 'K3', 'O3', 'S3'].forEach(cell => {
            worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Kuning
        });
        
        // Atur lebar kolom biar rapi
        worksheet.columns.forEach(column => { column.width = 12; });
        worksheet.getColumn(1).width = 5; // No
        worksheet.getColumn(2).width = 5; // Tgl

        // 5. Tulis Data Per Tanggal
        for (let d = 1; d <= daysInMonth; d++) {
            const rowData = reportData[d];
            const rowNum = d + 5; // Mulai dari baris 6

            // Kantor
            const k_org = rowData['Area Kantor'].organik;
            const k_ano = rowData['Area Kantor'].anorganik;
            const k_res = rowData['Area Kantor'].residu;
            const k_tot = k_org + k_ano + k_res;

            // Parkir
            const p_org = rowData['Area Parkir'].organik;
            const p_ano = rowData['Area Parkir'].anorganik;
            const p_res = rowData['Area Parkir'].residu;
            const p_tot = p_org + p_ano + p_res;

            // Makan
            const m_org = rowData['Area Makan'].organik;
            const m_ano = rowData['Area Makan'].anorganik;
            const m_res = rowData['Area Makan'].residu;
            const m_tot = m_org + m_ano + m_res;

            // Tunggu
            const t_org = rowData['Area Ruang Tunggu'].organik;
            const t_ano = rowData['Area Ruang Tunggu'].anorganik;
            const t_res = rowData['Area Ruang Tunggu'].residu;
            const t_tot = t_org + t_ano + t_res;

            // Grand Total Harian
            const dailyTotal = k_tot + p_tot + m_tot + t_tot;

            const row = worksheet.getRow(rowNum);
            row.values = [
                d, d, // No, Tanggal
                k_org, k_ano, k_res, k_tot, // Kantor
                p_org, p_ano, p_res, p_tot, // Parkir
                m_org, m_ano, m_res, m_tot, // Makan
                t_org, t_ano, t_res, t_tot, // Tunggu
                dailyTotal // Total Harian
            ];
        }

        // 6. Tambahkan Baris Total Bulanan di Bawah
        const lastRow = daysInMonth + 6;
        worksheet.getCell(`A${lastRow}`).value = 'TOTAL BULANAN';
        worksheet.mergeCells(`A${lastRow}:B${lastRow}`);
        
        // Rumus Sum Excel (C6 sampai C_lastRow-1)
        for(let col=3; col<=19; col++) { // Kolom C sampai S
            const colLetter = worksheet.getColumn(col).letter;
            worksheet.getCell(`${colLetter}${lastRow}`).value = { formula: `SUM(${colLetter}6:${colLetter}${lastRow-1})` };
            worksheet.getCell(`${colLetter}${lastRow}`).font = { bold: true };
        }

        // Beri Border untuk semua sel data
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        // Kirim File
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Lengkap_${targetMonth}-${targetYear}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error saat ekspor Excel:', err.message);
        res.status(500).json({ message: 'Gagal membuat file Excel.' });
    }
});


// --- Server Listen --- (TIDAK BERUBAH)
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});