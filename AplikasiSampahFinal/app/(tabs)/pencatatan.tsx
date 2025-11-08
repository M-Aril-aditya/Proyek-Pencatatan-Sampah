import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';

// --- DEFINISI TIPE (UNTUK MEMPERBAIKI ERROR) ---
interface Field {
  id: string;
  label: string;
}
interface Section {
  title: string;
  fields: Field[];
}
interface DataStructureType {
  [key: string]: Section[];
}
interface ExportRow {
  area: string;
  section: string;
  item_label: string;
  item_id: string;
  weight: string;
}
// --------------------------------------------------

// --- STRUKTUR DATA (DARI KODE ANDA, TIDAK DIUBAH) ---
const DAFTAR_AREA = [
    { label: 'Area Kantor', value: 'area_kantor' },
    { label: 'Area Parkir / Taman / Jalan', value: 'area_parkir' },
    { label: 'Area Tempat Makan', value: 'area_tempat_makan' },
    { label: 'Area Ruang Tunggu', value: 'area_ruang_tunggu' },
];

const DATA_STRUCTURE: DataStructureType = {
  'area_kantor': [
    { title: 'CV Tunas Baru', fields: [ { id: 'kertas_cv', label: 'Kertas (Kg)' }, { id: 'kardus_cv', label: 'Kardus (Kg)' }, { id: 'plastik_cv', label: 'Plastik (Kg)' }, { id: 'duplex_cv', label: 'Duplex (Kg)' }, { id: 'kantung_semen_cv', label: 'Kantung Semen (Kg)' } ] },
    { title: 'Bank Sampah', fields: [ { id: 'plastik_bank', label: 'Plastik (Kg)' }, { id: 'kardus_bank', label: 'Kardus (Kg)' }, { id: 'duplex_bank', label: 'Duplex (Kg)' } ] },
    { title: 'Sampah Lainnya Area Kantor', fields: [ { id: 'sampah_campur', label: 'Sampah Campur (Kg)' }, { id: 'vial', label: 'Vial (Kg)' }, { id: 'drum_kardus', label: 'Drum Kardus (Kg)' }, { id: 'botol', label: 'Botol (Kg)' } ] },
    { title: 'Terkelola Dan Tidak Terkelola', fields: [ { id: 'kil_terkelola', label: 'TERKELOLA' }, { id: 'kil_tidak_terkelola', label: 'TIDAK TERKELOLA' }, ] }
  ],
  'area_parkir': [
    { title: 'Area Parkir / Taman / Jalan', fields: [ { id: 'daun_kering', label: 'Daun Kering' }, ] },
    { title: 'Terkelola Dan Tidak Terkelola', fields: [ { id: 'kil_terkelola', label: 'TERKELOLA' }, { id: 'kil_tidak_terkelola', label: 'TIDAK TERKELOLA' }, ] }
  ],
  'area_tempat_makan': [
    { title: 'Area Tempat Makan', fields: [ { id: 'gelas_plastik', label: 'Gelas Plastik' }, { id: 'sampah_kantin_warehouse', label: 'Sampah Kantin Warehouse' }, { id: 'sampah_kantin_pabrik', label: 'Sampah Kantin Pabrik' } ] },
    { title: 'Terkelola Dan Tidak Terkelola', fields: [ { id: 'kil_terkelola', label: 'TERKELOLA' }, { id: 'kil_tidak_terkelola', label: 'TIDAK TERKELOLA'}, ] }
  ],
  'area_ruang_tunggu': [
    { title: 'Area Ruang Tunggu', fields: [ { id: 'organik', label: 'Organik' }, { id: 'anorganik', label: 'Anorganik' }, { id: 'residu', label: 'Residu'}, ] },
    { title: 'Terkelola Dan Tidak Terkelola', fields: [ { id: 'kil_terkelola', label: 'TERKELOLA' }, { id: 'kil_tidak_terkelola', label: 'TIDAK TERKELOLA' }, ] }
  ]
};

const HISTORY_STORAGE_KEY = 'wasteHistory_v3';

export default function PencatatanScreen() {
  const router = useRouter();
  const { user } = useLocalSearchParams();
  // --- PERBAIKAN STATE ERROR ---
  const [selectedAreaState, setSelectedAreaInternal] = useState<string | null>(null);
  // -----------------------------
  const [dateTime, setDateTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [bobotSampah, setBobotSampah] = useState<{ [key: string]: string }>({});

  // --- FUNGSI BARU UNTUK ATUR AREA & RESET BOBOT ---
  const setSelectedArea = (value: string | null) => {
    setSelectedAreaInternal(value);
    // Kosongkan data bobot lama saat area diganti
    setBobotSampah({}); 
  };
  // ------------------------------------------------

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
       allHistory[userKey] = bobotSampah;
       await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
       Alert.alert('Tersimpan', 'Data berhasil disimpan sementara di perangkat.');
    } catch (error) {
       console.error("Gagal menyimpan riwayat:", error);
       Alert.alert("Error", "Gagal menyimpan data riwayat.");
    }
  };

  const handleEkspor = async () => {
      const userKey = user ? user.toString() : null;
      const areaKey = selectedAreaState as string; // Gunakan state yang sudah diganti namanya
      
      if (!userKey || !areaKey) {
          Alert.alert('Gagal', 'Pastikan Area dan User sudah teridentifikasi.');
          return;
      }

      const areaStructure = DATA_STRUCTURE[areaKey] || [];
      const dataToExport: ExportRow[] = []; // Terapkan tipe

      areaStructure.forEach((section: Section) => { // Terapkan tipe
          section.fields.forEach((field: Field) => { // Terapkan tipe
              const weight = bobotSampah[field.id];
              if (weight && parseFloat(weight) > 0) {
                  dataToExport.push({
                      area: areaKey,
                      section: section.title,
                      item_label: field.label,
                      item_id: field.id,
                      weight: weight
                  });
              }
          });
      });

      if (dataToExport.length === 0) {
          Alert.alert('Gagal', 'Tidak ada data bobot sampah yang diisi untuk diekspor.');
          return;
      }

      // Perbaiki header CSV (hapus ID Item)
      const headerString = 'Area,Section,Nama Item,Bobot (Kg),Petugas,Waktu Catat\n';
      // Perbaiki baris CSV (hapus ID Item)
      const rowString = dataToExport.map((row: ExportRow) => 
          `"${DAFTAR_AREA.find(a => a.value === row.area)?.label}","${row.section}","${row.item_label}",${row.weight},"${userKey}","${dateTime}"\n`
      ).join('');
      
      const csvString = `${headerString}${rowString}`;
      
      // --- PERUBAHAN NAMA FILE (SESUAI PERMINTAAN ANDA) ---
      const now = new Date();
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const userName = userKey ? userKey.toLowerCase() : 'unknown';
      const filename = `green-${userName}-${day}${month}${year}-${hours}${minutes}.csv`;
      // --- BATAS AKHIR PERUBAHAN NAMA FILE ---
      
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
                  } catch (e: any) { // Terapkan tipe 'any'
                      console.error("Gagal update history setelah hapus: ", e);
                  }
              }}
          ]);

      } catch (error: any) { // Terapkan tipe 'any'
          console.error('Error saat ekspor:', error);
          Alert.alert('Error', 'Gagal membuat atau membagikan file CSV.');
      }
  };

  const renderDynamicForm = () => {
    const areaKey = selectedAreaState as string; 
    if (!areaKey) {
      return <Text style={styles.placeholderText}>Silakan pilih area terlebih dahulu...</Text>;
    }
    
    const areaStructure = DATA_STRUCTURE[areaKey]; 
    if (!areaStructure) {
      return <Text style={styles.placeholderText}>Struktur data untuk area ini tidak ditemukan.</Text>;
    }

    return (
      <View>
        {areaStructure.map((section: Section, index: number) => (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.fields.map((field: Field) => (
              <View key={field.id} style={styles.itemRowContainer}>
                <Text style={styles.itemNama}>{field.label}</Text>
                <TextInput
                    style={styles.inputBox}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => handleInputChange(field.id, text)}
                    value={bobotSampah[field.id] || ''}
                    placeholder="0.0"
                    placeholderTextColor="#aaa"
                />
              </View>
            ))}
          </View>
        ))}
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
      {/* Header (Area, User, Waktu) */}
      <View style={styles.headerContainer}>
        <View style={styles.pickerContainer}>
          <RNPickerSelect
              placeholder={{ label: "Pilih Area...", value: null }}
              items={DAFTAR_AREA}
              onValueChange={(value) => setSelectedArea(value)} // Panggil fungsi setter kustom
              style={pickerSelectStyles}
              value={selectedAreaState} // Gunakan state yang sudah diganti namanya
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
        {/* PERBAIKAN ERROR ROUTER */}
        <Button title="Logout" color="#C0392B" onPress={() => router.replace('/')} />
      </View>
    </ScrollView>
  );
}

// --- STYLESHEET (TIDAK BERUBAH) ---
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f7f7f7' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 10, backgroundColor: 'white', borderRadius: 8, elevation: 2, },
  pickerContainer: { flex: 1.5, marginRight: 10, },
  userInfoContainer: { flex: 1, alignItems: 'flex-end', },
  headerText: { fontSize: 16, fontWeight: '500' },
  dateTimeText: { fontSize: 12, color: '#666', marginTop: 4, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7' },
  placeholderText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 30, fontStyle: 'italic', },
  sectionContainer: { marginBottom: 20, backgroundColor: 'white', borderRadius: 8, elevation: 1, overflow: 'hidden', },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: 'white', backgroundColor: '#1D5D50', padding: 12, },
  itemRowContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
  itemNama: { flex: 2, fontSize: 16, },
  inputBox: { flex: 1, borderWidth: 1, borderColor: '#ccc', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 5, textAlign: 'center', fontSize: 16, marginLeft: 10, },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: { fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, color: 'black', paddingRight: 30, },
  inputAndroid: { fontSize: 16, fontWeight: '500', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, color: 'black', paddingRight: 30, },
});