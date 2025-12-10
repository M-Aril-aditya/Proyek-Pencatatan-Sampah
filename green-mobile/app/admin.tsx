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

// Link Backend Vercel Anda
// GUNAKAN LINK BACKEND INI (Bukan link dashboard):
const API_URL = 'https://proyek-pencatatan-sampah.vercel.app/api';
// Definisikan tipe User
interface User {
  id: number;
  username: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Muat daftar user saat halaman dibuka
  useEffect(() => {
    loadUsers();
  }, []);

  // 1. Ambil Data dari Cloud (GET) - DENGAN PERBAIKAN ERROR
  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/petugas`);
      console.log("Data Petugas:", response.data); // Cek di terminal

      // Pastikan data yang diterima adalah Array. Jika tidak, set array kosong.
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.error('Gagal memuat petugas:', e);
      // Jangan tampilkan alert terus menerus jika error koneksi, cukup log saja
    }
  };

  // 2. Tambah User ke Cloud (POST)
  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      Alert.alert('Gagal', 'Username dan Password tidak boleh kosong.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/petugas`, {
        username: newUsername.trim(),
        password: newPassword.trim()
      });
      
      Alert.alert('Sukses', `Petugas ${newUsername} berhasil ditambahkan.`);
      setNewUsername(''); 
      setNewPassword('');
      loadUsers(); // Refresh list
    } catch (e: any) {
      console.error('Gagal menambah petugas:', e);
      const msg = e.response?.data?.message || 'Gagal menambah petugas.';
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Hapus User dari Cloud (DELETE)
  const handleDeleteUser = async (id: number, username: string) => {
    Alert.alert(
      "Konfirmasi Hapus",
      `Yakin ingin menghapus petugas ${username}?`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: async () => {
            try {
              await axios.delete(`${API_URL}/petugas/${id}`);
              loadUsers(); // Refresh list
            } catch (e) {
              console.error('Gagal menghapus user:', e);
              Alert.alert('Error', 'Gagal menghapus petugas.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.topHeaderContainer}>
        <Text style={styles.title}>Manajemen Petugas</Text>
        <TouchableOpacity 
          style={styles.smallLogoutButton} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* FORM INPUT */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Tambah Akun Baru</Text>
        <TextInput
          style={styles.input}
          placeholder="Username Petugas"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry 
        />
        
        {loading ? (
          <ActivityIndicator size="small" color="#1D5D5D" />
        ) : (
          <Button title="Simpan Petugas" onPress={handleAddUser} color="#1D5D5D" />
        )}
      </View>

      {/* DAFTAR USER - DENGAN PERBAIKAN FLATLIST */}
      <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 10 }]}>Daftar Petugas Terdaftar:</Text>
      
      <FlatList
        data={users}
        // PERBAIKAN UTAMA: Cek apakah item & item.id ada. Jika tidak, pakai index.
        keyExtractor={(item, index) => (item && item.id) ? item.id.toString() : index.toString()}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <View style={styles.avatar}>
                    <Text style={{color:'white', fontWeight:'bold'}}>
                      {item.username ? item.username.charAt(0).toUpperCase() : '?'}
                    </Text>
                </View>
                <Text style={styles.userName}>{item.username || 'Tanpa Nama'}</Text>
            </View>
            <TouchableOpacity 
              // Pastikan id ada sebelum delete
              onPress={() => item.id && handleDeleteUser(item.id, item.username)} 
              style={styles.deleteButton}
            >
                <Text style={{color:'white', fontSize:12}}>Hapus</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{textAlign:'center', color:'#888', marginTop:20}}>
            Belum ada petugas terdaftar.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f8f9fa' },
  
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#2c3e50' 
  },
  smallLogoutButton: {
    backgroundColor: '#e74c3c', 
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  smallLogoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  formContainer: { 
    marginBottom: 25, 
    padding: 20, 
    backgroundColor: 'white', 
    borderRadius: 12,
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fbfbfb',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 14,
  },
  
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498db', justifyContent:'center', alignItems:'center', marginRight: 10
  },
  userName: { fontSize: 16, fontWeight: '500', color: '#333' },
  deleteButton: {
      backgroundColor: '#ff6b6b',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6
  }
});