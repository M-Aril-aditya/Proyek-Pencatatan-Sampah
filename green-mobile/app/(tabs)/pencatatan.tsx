import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Keyboard,
  Platform,

  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
// --- DEFINISI TIPE ---
interface Field {
  id: string;
  label: string;
  pengelola: string; 
}

interface WasteCategories {
  organik: Field[];
  anorganik: Field[];
  tidakTerkelola: Field[];
}

interface ExportRow {
  area: string;
  item_label: string;
  item_id: string;
  weight: string;
  status: 'Organik Terpilah' | 'Anorganik Terpilah' | 'Tidak Terkelola'; 
  pengelola: string;
}
// ------------------------------------

const DAFTAR_AREA = [
  { label: 'Area Kantor', value: 'Area Kantor' },
  { label: 'Area Parkir', value: 'Area Parkir' }, 
  { label: 'Area Makan', value: 'Area Makan' },   
  { label: 'Area Ruang Tunggu', value: 'Area Ruang Tunggu' },
];

// --- DATA GLOBAL (SERAGAM) ---
const DATA_SAMPAH_GLOBAL: WasteCategories = {
  organik: [
    { id: 'daun_kering', label: 'Daun Kering', pengelola: '-' },
    { id: 'sampah_makanan', label: 'Sampah Makanan', pengelola: '-' },
  ],
  anorganik: [
    { id: 'kertas', label: 'Kertas', pengelola: '-' },
    { id: 'kardus', label: 'Kardus', pengelola: '-' },
    { id: 'plastik', label: 'Plastik', pengelola: '-' },
    { id: 'duplex', label: 'Duplex', pengelola: '-' },
    { id: 'kantong_semen', label: 'Kantong Semen', pengelola: '-' },
  ],
  tidakTerkelola: [
    // Item 'vial' dan 'botol' sudah dihapus dari sini
    { id: 'drum_vat', label: 'Drum Vat', pengelola: '-' },
    { id: 'residu_lainnya', label: 'Residu Lainnya', pengelola: '-' },
  ]
};

const HISTORY_STORAGE_KEY = 'wasteHistory_v4_revisi'; 

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
    const cleanedText = text.replace(/[^0-9.]/g, '');
    setBobotSampah(prevState => ({ ...prevState, [id]: cleanedText }));
  };

  // --- (BARU) Fungsi Hapus Input ---
  const handleClearInput = (id: string) => {
    setBobotSampah(prevState => {
      const newState = { ...prevState };
      delete newState[id]; // Hapus data bobot untuk item ini
      return newState;
    });
  };
  // --------------------------------

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
        const existingUserHistory = allHistory[userKey] || {};
        const updatedUserHistory = { ...existingUserHistory, ...bobotSampah };
        allHistory[userKey] = updatedUserHistory; 
        await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
        Alert.alert('Tersimpan', 'Data berhasil disimpan sementara di perangkat.');
    } catch (error) {
        console.error("Gagal menyimpan riwayat:", error);
        Alert.alert("Error", "Gagal menyimpan data riwayat.");
    }
  };

  const handleEkspor = async () => {
      const userKey = user ? user.toString() : null;
      const areaName = selectedAreaState; 
      
      if (!userKey || !areaName) {
          Alert.alert('Gagal', 'Pastikan Area dan User sudah teridentifikasi.');
          return;
      }

      const areaData = DATA_SAMPAH_GLOBAL;
      const dataToExport: ExportRow[] = [];

      // Helper untuk loop data
      const collectData = (categoryData: Field[], statusLabel: ExportRow['status']) => {
        categoryData.forEach((field: Field) => {
          const weight = bobotSampah[field.id];
          if (weight && parseFloat(weight) > 0) {
              dataToExport.push({
                  area: areaName,
                  item_label: field.label,
                  item_id: field.id,
                  weight: weight,
                  status: statusLabel,
                  pengelola: field.pengelola
              });
          }
        });
      };

      collectData(areaData.organik, 'Organik Terpilah');
      collectData(areaData.anorganik, 'Anorganik Terpilah');
      collectData(areaData.tidakTerkelola, 'Tidak Terkelola');

      if (dataToExport.length === 0) {
          Alert.alert('Gagal', 'Tidak ada data bobot sampah yang diisi untuk diekspor.');
          return;
      }

      const headerString = 'Area,Nama Item,Pengelola,Status,Bobot (Kg),Petugas,Waktu Catat\n';
      
      const rowString = dataToExport.map((row: ExportRow) => 
          `"${row.area}",` + 
          `"${row.item_label}",` +
          `"${row.pengelola}",` +
          `"${row.status}",` +
          `${row.weight},` +
          `"${userKey}",` +
          `"${dateTime}"\n`
      ).join('');
      
      const csvString = `\uFEFF${headerString}${rowString}`;
      
      const now = new Date();
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const userName = userKey ? userKey.toLowerCase() : 'unknown';
      const safeAreaName = areaName.replace(/\s+/g, '_');
      const filename = `green-${userName}-${safeAreaName}-${day}${month}${year}-${hours}${minutes}.csv`;
      
      // --- 2. LOGIKA BARU (CABANG WEB VS MOBILE) ---
      
      if (Platform.OS === 'web') {
        // === JIKA DI WEB (BROWSER / PWA) ===
        // Kita gunakan fitur download bawaan browser
        try {
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            // Buat elemen <a> palsu untuk trigger download
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Gagal download di web:", e);
            Alert.alert("Error", "Gagal mengunduh file di browser.");
            return;
        }

      } else {
        // === JIKA DI MOBILE (ANDROID APK) ===
        // Tetap gunakan FileSystem seperti kode lama Anda
        const fileUri = (FileSystem as any).documentDirectory + filename;
        try {
            await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
            await Sharing.shareAsync(fileUri);
        } catch (error: any) {
            console.error('Error saat ekspor mobile:', error);
            Alert.alert('Error', 'Gagal membuat atau membagikan file CSV.');
            return; // Stop jika gagal
        }
      }

      // --- 3. KONFIRMASI HAPUS DATA (BERLAKU UNTUK KEDUANYA) ---
      // Kode ini tetap jalan baik di Web maupun Mobile setelah file terunduh
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
  };

  const renderDynamicForm = () => {
    const areaKey = selectedAreaState; 
    if (!areaKey) {
      return <Text style={styles.placeholderText}>Silakan pilih area terlebih dahulu...</Text>;
    }
    
    const areaData = DATA_SAMPAH_GLOBAL;

    const renderField = (field: Field) => (
      <View key={field.id} style={styles.itemRowContainer}>
        <Text style={styles.itemNama}>{field.label} (Kg)</Text> 
        
        {/* Wrapper untuk Input dan Tombol Hapus */}
        <View style={styles.inputWrapper}>
          <TextInput
              style={styles.inputBox}
              keyboardType="decimal-pad"
              onChangeText={(text) => handleInputChange(field.id, text)}
              value={bobotSampah[field.id] || ''}
              placeholder="0.0"
              placeholderTextColor="#aaa"
          />
          {/* Tombol Hapus (X) */}
          {bobotSampah[field.id] ? (
            <TouchableOpacity onPress={() => handleClearInput(field.id)} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>X</Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </View>
    );

    return (
      <View>
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { backgroundColor: '#27ae60' }]}>Sampah Organik Terpilah</Text>
          {areaData.organik.map(renderField)}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { backgroundColor: '#f39c12' }]}>Sampah Anorganik Terpilah</Text>
          {areaData.anorganik.map(renderField)}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { backgroundColor: '#c0392b' }]}>Sampah Tidak Terkelola</Text>
          {areaData.tidakTerkelola.map(renderField)}
        </View>
      </View>
    );
  };

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
      
      <View style={styles.topHeaderContainer}>
        <Text style={styles.screenTitle}>Input Data</Text>
        <TouchableOpacity 
          style={styles.smallLogoutButton} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f7f7f7' },
  
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  screenTitle: {
    fontSize: 24, 
    fontWeight: 'bold',
    color: '#333',
  },
  smallLogoutButton: {
    backgroundColor: '#C0392B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallLogoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 10, backgroundColor: 'white', borderRadius: 8, elevation: 2, },
  pickerContainer: { flex: 1.5, marginRight: 10, },
  userInfoContainer: { flex: 1, alignItems: 'flex-end', },
  headerText: { fontSize: 16, fontWeight: '500' },
  dateTimeText: { fontSize: 12, color: '#666', marginTop: 4, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7' },
  placeholderText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 30, fontStyle: 'italic', },
  
  sectionContainer: { 
    marginBottom: 20, 
    backgroundColor: '#ECECEC', 
    borderRadius: 16, 
    elevation: 1, 
    overflow: 'hidden', 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#ffffffff', 
    padding: 16,
    paddingBottom: 12,
  },
  itemRowContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    backgroundColor: '#ECECEC', 
    borderTopWidth: 1, 
    borderTopColor: '#DDD',
  },
  itemNama: { flex: 2, fontSize: 16, maxWidth: '50%' }, // Batasi lebar nama agar input muat
  
  // --- STYLE BARU UNTUK INPUT & TOMBOL HAPUS ---
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  inputBox: { 
    width: 80, // Lebar tetap untuk input
    borderWidth: 1, 
    borderColor: '#ccc', 
    backgroundColor: 'white', 
    paddingVertical: 8, 
    paddingHorizontal: 10, 
    borderRadius: 8, 
    textAlign: 'center', 
    fontSize: 16, 
    marginLeft: 10, 
  },
  clearButton: {
    marginLeft: 8,
    backgroundColor: '#ffcccc',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#C0392B',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // ---------------------------------------------

  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, },
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