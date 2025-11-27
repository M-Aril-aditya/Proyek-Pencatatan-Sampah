import React from 'react';

// (Opsional) Tambahkan sedikit style untuk paragraf agar lebih rapi
const styles = {
  paragraph: {
    lineHeight: '1.6', // Jarak antar baris
    marginBottom: '1rem', // Jarak antar paragraf
    fontSize: '16px',
    color: '#333', // Warna teks agar tidak terlalu hitam
  },
  subHeader: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1D5D50', // Warna hijau tema Anda
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
  },
  list: {
    paddingLeft: '20px',
  },
  listItem: {
    marginBottom: '0.5rem',
    lineHeight: '1.5',
  }
};

function Tentang() {
  return (
    <div className="content-section">
      {/* Judul utama */}
      <h2>🌳 Tentang Green: Sistem Monitoring & Pelaporan Sampah</h2>
      
      <p style={styles.paragraph}>
        Selamat datang di Dashboard Pelaporan Green. Kami adalah platform terintegrasi yang dirancang untuk mendigitalkan dan mengoptimalkan proses pencatatan serta pelaporan sampah di lingkungan Anda.
      </p>
      <p style={styles.paragraph}>
        Misi kami adalah mengubah data sampah yang mentah menjadi wawasan yang actionable (dapat ditindaklanjuti), demi manajemen operasional yang lebih efisien dan transparan.
      </p>

      {/* Sub-judul */}
      <h3 style={styles.subHeader}>Ekosistem Kami</h3>
      <p style={styles.paragraph}>
        Sistem "Green" terdiri dari dua komponen utama yang saling terhubung:
      </p>
      <ul style={styles.list}>
        <li style={styles.listItem}>
          <strong>Aplikasi Mobile (Pencatatan):</strong> Alat di garis depan yang digunakan oleh petugas lapangan. Aplikasi ini memungkinkan pencatatan data sampah (seperti jenis, area, dan bobot) secara <em>real-time</em>, menggantikan formulir kertas dan mengurangi kesalahan manusia.
        </li>
        <li style={styles.listItem}>
          <strong>Dashboard Web (Pelaporan - Situs Ini):</strong> Ini adalah pusat komando Anda. Website ini dirancang untuk admin dan manajer guna mengelola, menganalisis, dan memvisualisasikan semua data yang terkumpul.
        </li>
      </ul>

      {/* Sub-judul */}
      <h3 style={styles.subHeader}>Apa yang Dapat Anda Lakukan di Sini?</h3>
      <p style={styles.paragraph}>
        Dashboard web ini memberi Anda kemampuan untuk:
      </p>
      <ul style={styles.list}>
        <li style={styles.listItem}>
          <strong>Mengelola Data:</strong> Mengunggah data (file CSV) yang dihasilkan oleh aplikasi mobile ke dalam satu database terpusat.
        </li>
        <li style={styles.listItem}>
          <strong>Memonitor Statistik:</strong> Menganalisis data sampah menggunakan filter <strong>Harian, Mingguan, Bulanan,</strong> dan <strong>Tahunan</strong>.
        </li>
        <li style={styles.listItem}>
          <strong>Visualisasi Wawasan:</strong> Memahami secara cepat proporsi sampah <strong>Terkelola</strong> vs. <strong>Tidak Terkelola</strong> melalui <em>pie chart</em> yang dinamis.
        </li>
        <li style={styles.listItem}>
          <strong>Melihat Rincian:</strong> Menelusuri data mentah dalam tabel yang terstruktur, lengkap dengan informasi Area, Petugas, dan Waktu Catat.
        </li>
        <li style={styles.listItem}>
          <strong>Mengekspor Laporan:</strong> Mengunduh laporan bulanan dan tahunan dalam format <strong>XLSX (Excel)</strong> untuk kebutuhan arsip atau analisis lebih lanjut.
        </li>
      </ul>

      {/* Sub-judul */}
      <h3 style={styles.subHeader}>Tujuan Kami</h3>
      <p style={styles.paragraph}>
        Tujuan Green adalah menyediakan alat bantu yang sederhana namun kuat untuk memastikan bahwa setiap gram sampah yang dicatat dapat dilacak dan dilaporkan dengan akurat, mendukung pengambilan keputusan yang lebih baik.
      </p>

    </div>
  );
}

export default Tentang;