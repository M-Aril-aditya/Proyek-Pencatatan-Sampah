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
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons'; // Import Ikon

// Pastikan URL ini benar sesuai deploy Anda
const API_URL = 'https://proyek-pencatatan-sampah.vercel.app/api';

interface User {
  id: number;
  username: string;
  password?: string; // Optional untuk menampung password dari DB
}

export default function AdminScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  
  // State untuk Tambah User
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false); // Toggle mata tambah user
  
  // State untuk Edit User (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false); // Toggle mata edit user

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  // --- 1. GET USERS ---
  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/petugas`);
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.log('Gagal memuat petugas (mungkin koneksi/server down)');
    }
  };

  // --- 2. CREATE USER ---
  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      Alert.alert('Gagal', 'Username dan Password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/petugas`, {
        username: newUsername.trim(),
        password: newPassword.trim()
      });
      Alert.alert('Sukses', 'Petugas berhasil ditambahkan.');
      setNewUsername(''); 
      setNewPassword('');
      loadUsers(); 
    } catch (e: any) {
      Alert.alert('Gagal', e.response?.data?.message || 'Gagal menambah petugas.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. DELETE USER ---
  const handleDeleteUser = async (id: number, username: string) => {
    Alert.alert(
      "Hapus Petugas?",
      `Yakin ingin menghapus ${username}?`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: async () => {
            try {
              await axios.delete(`${API_URL}/petugas/${id}`);
              loadUsers();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus petugas.');
            }
          }
        }
      ]
    );
  };

  // --- 4. PERSIAPAN UPDATE (BUKA MODAL) ---
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    // Jika backend mengirim password (plain), kita isi. Jika tidak, kosongkan.
    setEditPassword(user.password || ''); 
    setShowEditPassword(false); // Reset mata tertutup
    setModalVisible(true);
  };

  // --- 5. EKSEKUSI UPDATE ---
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setLoading(true);
      await axios.put(`${API_URL}/petugas/${editingUser.id}`, {
        username: editUsername,
        password: editPassword
      });
      
      Alert.alert("Sukses", "Data petugas diperbarui!");
      setModalVisible(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      Alert.alert("Gagal", "Gagal mengupdate data petugas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.topHeaderContainer}>
        <Text style={styles.title}>Manajemen Petugas</Text>
        <TouchableOpacity style={styles.smallLogoutButton} onPress={() => router.replace('/')}>
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* FORM TAMBAH USER */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Tambah Akun Baru</Text>
        <TextInput
          style={styles.input}
          placeholder="Username Petugas"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
        />
        
        {/* Input Password dengan Mata */}
        <View style={styles.passwordContainer}>
            <TextInput
            style={styles.inputPassword}
            placeholder="Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword} // Logika Mata
            />
            <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                <Ionicons name={showNewPassword ? "eye" : "eye-off"} size={20} color="gray" />
            </TouchableOpacity>
        </View>
        
        {loading ? (
          <ActivityIndicator size="small" color="#1D5D5D" />
        ) : (
          <Button title="Simpan Petugas" onPress={handleAddUser} color="#1D5D5D" />
        )}
      </View>

      {/* LIST PETUGAS */}
      <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 10 }]}>Daftar Petugas:</Text>
      
      <FlatList
        data={users}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <View style={styles.avatar}>
                    <Text style={{color:'white', fontWeight:'bold'}}>
                      {item.username ? item.username.charAt(0).toUpperCase() : '?'}
                    </Text>
                </View>
                <Text style={styles.userName}>{item.username}</Text>
            </View>
            
            <View style={{flexDirection: 'row', gap: 10}}>
                {/* Tombol EDIT (Kuning/Orange) */}
                <TouchableOpacity 
                    onPress={() => openEditModal(item)} 
                    style={[styles.actionButton, { backgroundColor: '#f39c12' }]}
                >
                    <Ionicons name="pencil" size={16} color="white" />
                </TouchableOpacity>

                {/* Tombol HAPUS (Merah) */}
                <TouchableOpacity 
                    onPress={() => item.id && handleDeleteUser(item.id, item.username)} 
                    style={[styles.actionButton, { backgroundColor: '#ff6b6b' }]}
                >
                    <Ionicons name="trash" size={16} color="white" />
                </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{textAlign:'center', color:'#888'}}>Belum ada data.</Text>}
      />

      {/* --- MODAL EDIT (POP-UP) --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Petugas</Text>
                
                <Text style={styles.label}>Username</Text>
                <TextInput
                    style={styles.input}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    autoCapitalize="none"
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.inputPassword}
                        value={editPassword}
                        onChangeText={setEditPassword}
                        secureTextEntry={!showEditPassword}
                    />
                    <TouchableOpacity onPress={() => setShowEditPassword(!showEditPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showEditPassword ? "eye" : "eye-off"} size={20} color="gray" />
                    </TouchableOpacity>
                </View>

                <View style={styles.modalButtons}>
                    <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                        <Text style={styles.btnText}>Batal</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnSave]} onPress={handleUpdateUser}>
                        <Text style={styles.btnText}>Simpan Perubahan</Text>
                    </Pressable>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f8f9fa' },
  topHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  smallLogoutButton: { backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  smallLogoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  formContainer: { marginBottom: 25, padding: 20, backgroundColor: 'white', borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#34495e', marginBottom: 15 },
  
  // Style Input Biasa
  input: { borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', padding: 12, marginBottom: 15, borderRadius: 8 },
  
  // Style Input Password dengan Mata
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', borderRadius: 8, marginBottom: 15 },
  inputPassword: { flex: 1, padding: 12 },
  eyeIcon: { padding: 10 },

  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498db', justifyContent:'center', alignItems:'center', marginRight: 10 },
  userName: { fontSize: 16, fontWeight: '500', color: '#333' },
  
  actionButton: { padding: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },

  // Styles MODAL
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color:'#1D5D5D' },
  label: { marginBottom: 5, color: '#666', fontWeight:'600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#95a5a6' },
  btnSave: { backgroundColor: '#1D5D5D' },
  btnText: { color: 'white', fontWeight: 'bold' }
});