import AsyncStorage from '@react-native-async-storage/async-storage';
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
  TouchableOpacity // <-- 1. Tambahan Import
} from 'react-native';
import { USER_STORAGE_KEY } from './index'; 

// Definisikan tipe User
interface User {
  id: string;
  fullName: string;
  password?: string; 
}

export default function AdminScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Muat daftar user saat halaman dibuka
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersString = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (usersString) {
        setUsers(JSON.parse(usersString));
      }
    } catch (e) {
      console.error('Gagal memuat users:', e);
    }
  };

  // Fungsi Tambah User
  const handleAddUser = async () => {
    if (!newName || !newPassword) {
      Alert.alert('Gagal', 'Nama dan Password tidak boleh kosong.');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(), // ID unik sederhana
      fullName: newName.trim(),
      password: newPassword.trim(),
    };

    try {
      const updatedUsers = [...users, newUser];
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUsers));
      setUsers(updatedUsers); // Update UI
      setNewName(''); // Kosongkan input
      setNewPassword('');
      Alert.alert('Sukses', `User ${newName} berhasil ditambahkan.`);
    } catch (e) {
      console.error('Gagal menyimpan user baru:', e);
    }
  };

  // Fungsi Hapus User
  const handleDeleteUser = async (id: string) => {
    Alert.alert(
      "Konfirmasi Hapus",
      "Apakah Anda yakin ingin menghapus user ini?",
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: async () => {
            try {
              const updatedUsers = users.filter(user => user.id !== id);
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUsers));
              setUsers(updatedUsers); // Update UI
            } catch (e) {
              console.error('Gagal menghapus user:', e);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      
      {/* --- 2. HEADER BARU (Judul Kiri, Logout Kanan) --- */}
      <View style={styles.topHeaderContainer}>
        <Text style={styles.title}>Manajemen Petugas</Text>
        <TouchableOpacity 
          style={styles.smallLogoutButton} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {/* ------------------------------------------------ */}

      {/* Form Tambah User */}
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nama Petugas Baru"
          value={newName}
          onChangeText={setNewName}
        />
        <TextInput
          style={styles.input}
          placeholder="Password Petugas Baru"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Button title="Tambah Petugas" onPress={handleAddUser} color="#1D5D5D" />
      </View>

      {/* Daftar User */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Text style={styles.userName}>{item.fullName}</Text>
            <Button title="Hapus" onPress={() => handleDeleteUser(item.id)} color="#C0392B" />
          </View>
        )}
      />

      {/* 3. TOMBOL LOGOUT BAWAH DIHAPUS */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f0f0f0' },
  
  // --- 4. STYLE BARU UNTUK HEADER ---
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#333' 
    // textAlign: 'center' dihapus agar rata kiri
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
  // ----------------------------------

  formContainer: { marginBottom: 20, padding: 15, backgroundColor: 'white', borderRadius: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userName: { fontSize: 16 },
});