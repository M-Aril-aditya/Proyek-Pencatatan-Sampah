import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';

// --- (PERUBAHAN) DEFINISI TIPE ---
// Dibuat lebih sederhana, status akan 'implisit' (tergantung dia ada di array mana)
interface Field {
  id: string;
  label: string;
  pengelola: string;
}
// Struktur baru untuk data
interface AreaData {
  terkelola: Field[];
  tidakTerkelola: Field[];
}
interface DataStructureType {
  [key: string]: AreaData;
}
// Tipe untuk baris ekspor
interface ExportRow {
  area: string;
  item_label: string;
  item_id: string;
  weight: string;
  status: 'Terkelola' | 'Tidak Terkelola';
  pengelola: string;
}
// ------------------------------------

const DAFTAR_AREA = [
  { label: 'Area Kantor', value: 'area_kantor' },
  { label: 'Area Parkir / Taman / Jalan', value: 'area_parkir' },
  { label: 'Area Tempat Makan', value: 'area_tempat_makan' },
  { label: 'Area Ruang Tunggu', value: 'area_ruang_tunggu' },
];

// --- (PERUBAHAN BESAR) STRUKTUR DATA BARU SESUAI DESAIN FIGMA ---
// Sekarang setiap area punya 2 properti: 'terkelola' dan 'tidakTerkelola'
// Ini 100% mencerminkan data Excel dan desain 2 Boks Anda.
const DATA_SAMPAH_PER_AREA: DataStructureType = {
  'area_kantor': {
    terkelola: [
      { id: 'kertas_cv', label: 'Kertas', pengelola: 'CV Tunas Baru / Bank Sampah' }, 
      { id: 'kardus_cv', label: 'Kardus', pengelola: 'CV Tunas Baru / Bank Sampah' }, 
      { id: 'plastik_cv', label: 'Plastik', pengelola: 'CV Tunas Baru / Bank Sampah' }, 
      { id: 'duplex_cv', label: 'Duplex', pengelola: 'CV Tunas Baru / Bank Sampah' }, 
      { id: 'kantung_semen_cv', label: 'Kantung Semen', pengelola: 'CV Tunas Baru' }, 
    ],
    tidakTerkelola: [
      { id: 'sampah_campur', label: 'Sampah Campur', pengelola: '-' }, 
      { id: 'vial', label: 'Vial', pengelola: '-' }, 
      { id: 'drum_kardus', label: 'Drum Kardus', pengelola: '-' }, 
      { id: 'botol', label: 'Botol', pengelola: '-' } 
    ]
  },
  'area_parkir': {
    terkelola: [
      // Sesuai Excel, 'Daun Kering' terkelola (salah lihat, harusnya tidak)
      // { id: 'daun_kering', label: 'Daun Kering', pengelola: '-' },  <- Dihapus dari sini
      // EDIT: Sesuai Excel, Daun Kering TIDAK TERKELOLA.
    ],
    tidakTerkelola: [
      { id: 'daun_kering', label: 'Daun Kering', pengelola: '-' }, // <-- Pindah ke sini
    ]
  },
  'area_tempat_makan': {
    terkelola: [
      { id: 'gelas_plastik', label: 'Gelas Plastik', pengelola: '-' }, 
    ], // <-- KOSONG, ini yang penting
    tidakTerkelola: [
      { id: 'sampah_kantin_warehouse', label: 'Sampah Kantin Warehouse', pengelola: '-' }, 
      { id: 'sampah_kantin_pabrik', label: 'Sampah Kantin Pabrik', pengelola: '-' } 
    ]
  },
  'area_ruang_tunggu': {
    terkelola: [
      { id: 'organik', label: 'Organik', pengelola: '-' },
    ],
    tidakTerkelola: [ 
      { id: 'anorganik', label: 'Anorganik', pengelola: '-' }, 
      { id: 'residu', label: 'Residu', pengelola: '-' }, 
    ]
  }
};
// --- BATAS PERUBAHAN DATA STRUCTURE ---

const HISTORY_STORAGE_KEY = 'wasteHistory_v3';

export default function PencatatanScreen() {
  const router = useRouter();
  const { user } = useLocalSearchParams();
  const [selectedAreaState, setSelectedAreaInternal] = useState<string | null>(null);
  const [dateTime, setDateTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [bobotSampah, setBobotSampah] = useState<{ [key: string]: string }>({});

  const setSelectedArea = (value: string | null) => {
    setSelectedAreaInternal(value); 
  };

  useEffect(() => {
    // (Fungsi useEffect, loadHistory, dll... tidak ada perubahan)
    const loadHistory = async () => {
      const userKey = user ? user.toString() : null;
      if (!userKey) {
        setIsLoading(false);
        return;
      }
      try {
        const allHistoryString = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        const allHistory = allHistoryString ? JSON.parse(allHistoryString) : {};
        const userHistory = allHistory[userKey] || {}; 
        setBobotSampah(userHistory);
      } catch (error) {
        console.error("Gagal memuat riwayat:", error);
        setBobotSampah({});
      } finally {
        setIsLoading(false);
      }
    };
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setDateTime(`${formattedDate} ${formattedTime}`);
    loadHistory();
  }, [user]);

  const handleInputChange = (id: string, text: string) => {
    // (Tidak ada perubahan)
    const cleanedText = text.replace(/[^0-9.]/g, '');
    setBobotSampah(prevState => ({ ...prevState, [id]: cleanedText }));
  };

  const handleSimpan = async () => {
    Keyboard.dismiss();
    const userKey = user ? user.toString() : null;
    if (!userKey) {
      Alert.alert("Error", "User tidak dikenal.");
      return;
    }
    try {
        const allHistoryString = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        const allHistory = allHistoryString ? JSON.parse(allHistoryString) : {};
        
        // --- PERBAIKAN DIMULAI DARI SINI ---

        // 1. Ambil data LAMA yang mungkin sudah tersimpan
        const existingUserHistory = allHistory[userKey] || {};

        // 2. Gabungkan data LAMA dengan data BARU (yang ada di state)
        const updatedUserHistory = {
          ...existingUserHistory,
          ...bobotSampah
        };
        
        // 3. Simpan data yang sudah digabung
        allHistory[userKey] = updatedUserHistory; 
        
        // --- PERBAIKAN SELESAI ---

        await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
        Alert.alert('Tersimpan', 'Data berhasil disimpan sementara di perangkat.');
    } catch (error) {
        console.error("Gagal menyimpan riwayat:", error);
        Alert.alert("Error", "Gagal menyimpan data riwayat.");
    }
  };

  // --- (PERUBAHAN) LOGIKA EKSPOR ---
  const handleEkspor = async () => {
      const userKey = user ? user.toString() : null;
      const areaKey = selectedAreaState as string;
      
      if (!userKey || !areaKey) {
          Alert.alert('Gagal', 'Pastikan Area dan User sudah teridentifikasi.');
          return;
      }

      // Ambil data sesuai struktur baru
      const areaData = DATA_SAMPAH_PER_AREA[areaKey];
      if (!areaData) {
        Alert.alert('Error', 'Data untuk area ini tidak ditemukan.');
        return;
      }
      
      const dataToExport: ExportRow[] = [];

      // 1. Loop data TERKELOLA
      areaData.terkelola.forEach((field: Field) => {
          const weight = bobotSampah[field.id];
          if (weight && parseFloat(weight) > 0) {
              dataToExport.push({
                  area: areaKey,
                  item_label: field.label,
                  item_id: field.id,
                  weight: weight,
                  status: 'Terkelola', // <-- Ditentukan di sini
                  pengelola: field.pengelola
              });
          }
      });

      // 2. Loop data TIDAK TERKELOLA
      areaData.tidakTerkelola.forEach((field: Field) => {
          const weight = bobotSampah[field.id];
          if (weight && parseFloat(weight) > 0) {
              dataToExport.push({
                  area: areaKey,
                  item_label: field.label,
                  item_id: field.id,
                  weight: weight,
                  status: 'Tidak Terkelola', // <-- Ditentukan di sini
                  pengelola: field.pengelola
              });
          }
      });

      if (dataToExport.length === 0) {
          Alert.alert('Gagal', 'Tidak ada data bobot sampah yang diisi untuk diekspor.');
          return;
      }

      // Header dan baris CSV (Sama seperti sebelumnya, sudah benar)
      const headerString = 'Area,Nama Item,Pengelola,Status,Bobot (Kg),Petugas,Waktu Catat\n';
      
      const rowString = dataToExport.map((row: ExportRow) => 
          `"${DAFTAR_AREA.find(a => a.value === row.area)?.label}",` +
          `"${row.item_label}",` +
          `"${row.pengelola}",` +
          `"${row.status}",` +
          `${row.weight},` +
          `"${userKey}",` +
          `"${dateTime}"\n`
      ).join('');
      
      const csvString = `${headerString}${rowString}`;
      
      // Logika pembuatan file (Sama seperti sebelumnya, sudah benar)
      const now = new Date();
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const userName = userKey ? userKey.toLowerCase() : 'unknown';
      const filename = `green-${userName}-${day}${month}${year}-${hours}${minutes}.csv`;
      
      const fileUri = (FileSystem as any).documentDirectory + filename;
      try {
          await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(fileUri);
          
          Alert.alert("Ekspor Berhasil", "Data telah diekspor. Hapus data yang sudah diinput dari HP?", [
              { text: "Tidak" },
              { text: "Ya, Hapus", onPress: async () => {
                  const newData = { ...bobotSampah };
                  dataToExport.forEach((row: ExportRow) => {
                      delete newData[row.item_id];
                  });
                  setBobotSampah(newData);
                  
                  try {
                      const allHistoryString = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
                      const allHistory = allHistoryString ? JSON.parse(allHistoryString) : {};
                      allHistory[userKey] = newData;
                      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
                  } catch (e: any) {
                      console.error("Gagal update history setelah hapus: ", e);
                  }
              }}
          ]);

      } catch (error: any) {
          console.error('Error saat ekspor:', error);
          Alert.alert('Error', 'Gagal membuat atau membagikan file CSV.');
      }
  };
  // --- BATAS AKHIR PERUBAHAN EKSPOR ---

  // --- (PERUBAHAN BESAR) renderDynamicForm ---
  // Ditulis ulang agar sesuai desain FIGMA (2 Boks Terpisah)
  const renderDynamicForm = () => {
    const areaKey = selectedAreaState; 
    if (!areaKey) {
      return <Text style={styles.placeholderText}>Silakan pilih area terlebih dahulu...</Text>;
    }
    
    const areaData = DATA_SAMPAH_PER_AREA[areaKey]; 
    if (!areaData) {
      return <Text style={styles.placeholderText}>Struktur data untuk area ini tidak ditemukan.</Text>;
    }

    // Helper untuk render baris input, agar tidak duplikat kode
    const renderField = (field: Field) => (
      <View key={field.id} style={styles.itemRowContainer}>
        <Text style={styles.itemNama}>{field.label} (Kg)</Text> 
        <TextInput
            style={styles.inputBox}
            keyboardType="decimal-pad"
            onChangeText={(text) => handleInputChange(field.id, text)}
            value={bobotSampah[field.id] || ''}
            placeholder="0.0"
            placeholderTextColor="#aaa"
        />
      </View>
    );

    return (
      <View>
        {/* --- BOKS 1: SAMPAH TERKELOLA --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sampah Terkelola</Text>
          {areaData.terkelola.length > 0 ? (
            areaData.terkelola.map(renderField)
          ) : (
            <Text style={styles.emptyListText}>- Tidak ada item -</Text>
          )}
        </View>

        {/* --- BOKS 2: SAMPAH TIDAK TERKELOLA --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sampah Tidak Terkelola</Text>
          {areaData.tidakTerkelola.length > 0 ? (
            areaData.tidakTerkelola.map(renderField)
          ) : (
            <Text style={styles.emptyListText}>- Tidak ada item -</Text>
          )}
        </View>
      </View>
    );
  };
  // --- BATAS AKHIR renderDynamicForm ---

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D5D50" />
        <Text style={{ marginTop: 10 }}>Memuat data...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Header (Area, User, Waktu) */}
      <View style={styles.headerContainer}>
        <View style={styles.pickerContainer}>
          <RNPickerSelect
            placeholder={{ label: "Pilih Area...", value: null }}
            items={DAFTAR_AREA}
            onValueChange={(value) => setSelectedArea(value)}
            style={pickerSelectStyles}
            value={selectedAreaState}
          />
        </View>
        <View style={styles.userInfoContainer}>
          <Text style={styles.headerText}>User: {user}</Text>
          <Text style={styles.dateTimeText}>{dateTime}</Text>
        </View>
      </View>

      {renderDynamicForm()}
      
      <View style={styles.buttonContainer}>
        <Button title="Simpan" onPress={handleSimpan} />
        <Button title="Ekspor CSV" onPress={handleEkspor} color="#1E8449" />
      </View>

      <View style={{marginTop: 40}}>
        <Button title="Logout" color="#C0392B" onPress={() => router.replace('/')} />
      </View>
    </ScrollView>
  );
}

// --- STYLESHEET (Sedikit Penyesuaian) ---
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f7f7f7' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 10, backgroundColor: 'white', borderRadius: 8, elevation: 2, },
  pickerContainer: { flex: 1.5, marginRight: 10, },
  userInfoContainer: { flex: 1, alignItems: 'flex-end', },
  headerText: { fontSize: 16, fontWeight: '500' },
  dateTimeText: { fontSize: 12, color: '#666', marginTop: 4, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7' },
  placeholderText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 30, fontStyle: 'italic', },
  
  // Ini adalah boks abu-abu di FIGMA
  sectionContainer: { 
    marginBottom: 20, 
    backgroundColor: '#ECECEC', // <-- Warna abu-abu seperti di FIGMA
    borderRadius: 16, // <-- Dibuat lebih bulat
    elevation: 1, 
    overflow: 'hidden', // <-- Penting untuk border radius
  },
  // Judul "Sampah Terkelola" / "Sampah Tidak Terkelola"
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#ffffffff', // <-- Warna teks hitam
    backgroundColor: '#1D5D50', // <-- Warna sama dengan kontainer
    padding: 16,
    paddingBottom: 12,
  },
  itemRowContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, // <-- Disesuaikan
    paddingVertical: 12,
    backgroundColor: '#ECECEC', // <-- Warna sama
    borderTopWidth: 1, // <-- Garis pemisah tipis
    borderTopColor: '#DDD',
  },
  itemNama: { flex: 2, fontSize: 16, },
  inputBox: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: '#ccc', 
    backgroundColor: 'white', // <-- Input field dibuat putih
    paddingVertical: 8, 
    paddingHorizontal: 10, 
    borderRadius: 8, // <-- Dibuat bulat
    textAlign: 'center', 
    fontSize: 16, 
    marginLeft: 10, 
  },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, },
  // Teks jika list-nya kosong
  emptyListText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  }
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: { fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, color: 'black', paddingRight: 30, backgroundColor: 'white' },
  inputAndroid: { fontSize: 16, fontWeight: '500', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, color: 'black', paddingRight: 30, backgroundColor: 'white' },
});