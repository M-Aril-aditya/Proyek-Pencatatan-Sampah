import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
  Alert, 
  Button, 
  FlatList, 
  StyleSheet, 
  Text, 
  TextInput, 
  View, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Ionicons } from '@expo/vector-icons'; // Pastikan install ini: npx expo install @expo/vector-icons

// Link Backend Vercel Anda
const API_URL = 'https://proyek-pencatatan-sampah.vercel.app/api';

// Definisikan tipe User
interface User {
  id: number;
  username: string;
  password: string;
}

export default function AdminScreen() {
  const router = useRouter();
  
  // --- STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);

  // State untuk Fitur Edit & Lihat Password
  const [editingId, setEditingId] = useState<number | null>(null); // Null = Mode Tambah, Angka = Mode Edit
  const [showPassword, setShowPassword] = useState(false); // false = bintang-bintang, true = teks biasa
  const [showPasswords, setShowPasswords] = useState<{ [key: number]: boolean }>({}); // Untuk toggle tampil password di daftar

  useEffect(() => {
    loadUsers();
  }, []);

  // --- HELPER: AMBIL TOKEN ---
  const getHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
        // Jika tidak ada token, paksa logout (opsional)
        // tapi kita biarkan dulu agar tidak error saat render
        return {}; 
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // 1. GET DATA (Ambil Daftar Petugas)
  const loadUsers = async () => {
    try {
      const config = await getHeaders();
      const response = await axios.get(`${API_URL}/petugas`, config);
      
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.log('Load error:', e); // Silent error agar tidak mengganggu UI
    }
  };

  // 2. FUNGSI SIMPAN (BISA TAMBAH ATAU UPDATE)
  const handleSave = async () => {
    // Validasi Input
    if (!passwordInput) {
      Alert.alert('Peringatan', 'Password tidak boleh kosong.');
      return;
    }

    setLoading(true);
    try {
      const config = await getHeaders();

      if (editingId) {
        // --- LOGIKA UPDATE (PUT) ---
        await axios.put(`${API_URL}/petugas/${editingId}`, {
          newPassword: passwordInput.trim()
        }, config);
        
        Alert.alert('Sukses', 'Password berhasil diubah!');
      } else {
        // --- LOGIKA TAMBAH BARU (POST) ---
        if (!usernameInput) {
            setLoading(false);
            return Alert.alert('Peringatan', 'Username wajib diisi!');
        }
        await axios.post(`${API_URL}/petugas`, {
          username: usernameInput.trim(),
          password: passwordInput.trim()
        }, config);
        
        Alert.alert('Sukses', `Petugas ${usernameInput} berhasil ditambahkan.`);
      }
      
      // Reset form setelah sukses
      resetForm();
      loadUsers();
      
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Terjadi kesalahan sistem.';
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. HAPUS USER
  const handleDeleteUser = async (id: number, username: string) => {
    Alert.alert(
      "Konfirmasi Hapus",
      `Yakin ingin menghapus petugas ${username}?`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: async () => {
            try {
              const config = await getHeaders();
              await axios.delete(`${API_URL}/petugas/${id}`, config);
              
              // Jika yang dihapus sedang diedit, reset form
              if (editingId === id) resetForm();
              
              loadUsers();
              Alert.alert("Info", "Data dihapus.");
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus petugas.');
            }
          } 
        }
      ]
    );
  };

  // --- HELPER FUNCTIONS ---

  // Mulai Edit (Isi form dengan data user yang dipilih)
  const startEditing = (user: User) => {
    setEditingId(user.id);
    setUsernameInput(user.username);
    setPasswordInput(user.password); // Tampilkan password saat ini
    setShowPassword(false); // Sembunyikan password secara default
  };

  // Reset Form ke Mode Awal
  const resetForm = () => {
    setEditingId(null);
    setUsernameInput('');
    setPasswordInput('');
    setShowPassword(false);
  };

  const handleLogout = async () => {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      router.replace('/');
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.topHeaderContainer}>
        <Text style={styles.title}>Manajemen Petugas</Text>
        <TouchableOpacity style={styles.smallLogoutButton} onPress={handleLogout}>
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* FORM AREA (KOTAK PUTIH) */}
      <View style={[styles.formContainer, editingId ? styles.editingBorder : {}]}>
        <Text style={styles.sectionTitle}>
          {editingId ? `Ganti Password: ${usernameInput}` : 'Tambah Akun Baru'}
        </Text>
        
        {/* Input Username */}
        <TextInput
          style={[styles.input, editingId ? styles.disabledInput : null]}
          placeholder="Username Petugas"
          value={usernameInput}
          onChangeText={setUsernameInput}
          autoCapitalize="none"
          editable={!editingId} // Tidak bisa edit username saat update password
        />
        
        {/* Input Password dengan ICON MATA */}
        <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={editingId ? "Password Baru" : "Password"}
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry={!showPassword} // Logika Toggle Mata
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="grey" />
            </TouchableOpacity>
        </View>
        
        {/* Tombol Action */}
        {loading ? (
          <ActivityIndicator size="small" color="#1D5D5D" />
        ) : (
          <View style={{gap: 10}}>
            <Button 
              title={editingId ? "Update Password" : "Simpan Petugas"} 
              onPress={handleSave} 
              color={editingId ? "#f39c12" : "#1D5D5D"} 
            />
            
            {editingId && (
              <Button title="Batal Edit" onPress={resetForm} color="#7f8c8d" />
            )}
          </View>
        )}
      </View>

      {/* DAFTAR PETUGAS */}
      <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 10 }]}>Daftar Petugas:</Text>
      
      <FlatList
        data={users}
        keyExtractor={(item, index) => (item && item.id) ? item.id.toString() : index.toString()}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            
            {/* Info User (Kiri) */}
            <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
                <View style={styles.avatar}>
                    <Text style={{color:'white', fontWeight:'bold'}}>
                      {item.username ? item.username.charAt(0).toUpperCase() : '?'}
                    </Text>
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.userName}>{item.username || 'Tanpa Nama'}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={{fontSize: 14, color: '#333'}}>{showPasswords[item.id] ? item.password : '***'}</Text>
                        <TouchableOpacity onPress={() => setShowPasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }))} style={{marginLeft: 5}}>
                            <Ionicons name={showPasswords[item.id] ? "eye-off" : "eye"} size={16} color="grey" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            
            {/* Tombol Aksi (Kanan) */}
            <View style={{flexDirection: 'row', gap: 8}}>
                <TouchableOpacity onPress={() => startEditing(item)} style={styles.editButton}>
                    <Text style={{color:'white', fontSize:12, fontWeight: 'bold'}}>Ubah Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => item.id && handleDeleteUser(item.id, item.username)} 
                    style={styles.deleteButton}
                >
                    <Text style={{color:'white', fontSize:12, fontWeight: 'bold'}}>Hapus</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{textAlign:'center', color:'#888', marginTop:20}}>
            Data kosong atau belum Login.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f8f9fa' },
  topHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  smallLogoutButton: { backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  smallLogoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  formContainer: { marginBottom: 25, padding: 20, backgroundColor: 'white', borderRadius: 12, elevation: 2, borderWidth: 1, borderColor: 'white' },
  editingBorder: { borderColor: '#f39c12', borderWidth: 2 }, // Border kuning saat edit
  
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#34495e', marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', padding: 12, marginBottom: 15, borderRadius: 8, fontSize: 14 },
  disabledInput: { backgroundColor: '#eee', color: '#888' },
  
  // Style Password dengan Mata
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', borderRadius: 8, marginBottom: 15 },
  passwordInput: { flex: 1, padding: 12, fontSize: 14 },
  eyeIcon: { padding: 10 },

  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498db', justifyContent:'center', alignItems:'center', marginRight: 10 },
  userName: { fontSize: 16, fontWeight: '500', color: '#333' },
  editButton: { backgroundColor: '#f39c12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  deleteButton: { backgroundColor: '#ff6b6b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }
});