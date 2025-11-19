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
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View,
  TouchableOpacity // <-- Tambahan Import
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';

// --- DEFINISI TIPE ---
interface Field {
  id: string;
  label: string;
  pengelola: string;
}
interface AreaData {
  terkelola: Field[];
  tidakTerkelola: Field[];
}
interface DataStructureType {
  [key: string]: AreaData;
}
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

// --- STRUKTUR DATA ---
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
    terkelola: [],
    tidakTerkelola: [
      { id: 'daun_kering', label: 'Daun Kering', pengelola: '-' }, 
    ]
  },
  'area_tempat_makan': {
    terkelola: [
      { id: 'gelas_plastik', label: 'Gelas Plastik', pengelola: '-' }, 
    ], 
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

        const updatedUserHistory = {
          ...existingUserHistory,
          ...bobotSampah
        };
        
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
      const areaKey = selectedAreaState as string;
      
      if (!userKey || !areaKey) {
          Alert.alert('Gagal', 'Pastikan Area dan User sudah teridentifikasi.');
          return;
      }

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
                  status: 'Terkelola',
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
                  status: 'Tidak Terkelola',
                  pengelola: field.pengelola
              });
          }
      });

      if (dataToExport.length === 0) {
          Alert.alert('Gagal', 'Tidak ada data bobot sampah yang diisi untuk diekspor.');
          return;
      }

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

  const renderDynamicForm = () => {
    const areaKey = selectedAreaState; 
    if (!areaKey) {
      return <Text style={styles.placeholderText}>Silakan pilih area terlebih dahulu...</Text>;
    }
    
    const areaData = DATA_SAMPAH_PER_AREA[areaKey]; 
    if (!areaData) {
      return <Text style={styles.placeholderText}>Struktur data untuk area ini tidak ditemukan.</Text>;
    }

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
      
      {/* --- HEADER BARU (Judul Kiri, Logout Kanan) --- */}
      <View style={styles.topHeaderContainer}>
        <Text style={styles.screenTitle}>Masukkan Sampah</Text>
        <TouchableOpacity 
          style={styles.smallLogoutButton} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      {/* Header Info User */}
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

      {/* TOMBOL LOGOUT BAWAH DIHAPUS */}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f7f7f7' },
  
  // --- STYLE BARU UNTUK HEADER ATAS ---
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
    backgroundColor: '#C0392B', // Merah
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallLogoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // -----------------------------------

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
    backgroundColor: '#1D5D50', 
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
  itemNama: { flex: 2, fontSize: 16, },
  inputBox: { 
    flex: 1, 
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