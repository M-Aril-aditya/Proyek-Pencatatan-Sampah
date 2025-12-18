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
  Pressable,
  Platform 
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons'; 

// URL Backend Anda
const API_URL = 'https://proyek-pencatatan-sampah.vercel.app/api';

interface User {
  id: number;
  username: string;
  password?: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  
  // State Input
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // State Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // State Loading & Visibility
  const [loading, setLoading] = useState(false);
  const [visiblePasswordMap, setVisiblePasswordMap] = useState<{[key: number]: boolean}>({});

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
      console.log('Gagal memuat petugas');
    }
  };

  // --- 2. CREATE USER ---
  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      alertWebOrMobile('Gagal', 'Username dan Password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/petugas`, {
        username: newUsername.trim(),
        password: newPassword.trim()
      });
      alertWebOrMobile('Sukses', 'Petugas berhasil ditambahkan.');
      setNewUsername(''); 
      setNewPassword('');
      loadUsers(); 
    } catch (e: any) {
      alertWebOrMobile('Gagal', e.response?.data?.message || 'Gagal menambah petugas.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. DELETE USER ---
  const handleDeleteUser = async (id: number, username: string) => {
    const executeDelete = async () => {
        try {
            await axios.delete(`${API_URL}/petugas/${id}`);
            const newMap = {...visiblePasswordMap};
            delete newMap[id];
            setVisiblePasswordMap(newMap);
            
            if (Platform.OS === 'web') window.alert("Petugas berhasil dihapus!");
            else Alert.alert("Sukses", "Petugas berhasil dihapus");
            loadUsers();
        } catch (e) {
            console.error(e);
            alertWebOrMobile('Error', 'Gagal menghapus petugas.');
        }
    };

    if (Platform.OS === 'web') {
        if (window.confirm(`Yakin hapus ${username}?`)) executeDelete();
    } else {
        Alert.alert("Konfirmasi", `Hapus ${username}?`, [
            { text: "Batal", style: "cancel" },
            { text: "Hapus", style: "destructive", onPress: executeDelete }
        ]);
    }
  };

  // --- 4. UPDATE USER ---
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword(user.password || ''); 
    setShowEditPassword(false);
    setModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      setLoading(true);
      await axios.put(`${API_URL}/petugas/${editingUser.id}`, {
        username: editUsername,
        password: editPassword
      });
      alertWebOrMobile("Sukses", "Data diperbarui!");
      setModalVisible(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      alertWebOrMobile("Gagal", "Gagal update data.");
    } finally {
      setLoading(false);
    }
  };

  const alertWebOrMobile = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const toggleRowPassword = (id: number) => {
    setVisiblePasswordMap(prev => ({
        ...prev,
        [id]: !prev[id]
    }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeaderContainer}>
        <Text style={styles.title}>Manajemen Petugas</Text>
        <TouchableOpacity style={styles.smallLogoutButton} onPress={() => router.replace('/')}>
          <Text style={styles.smallLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Tambah Akun Baru</Text>
        <TextInput
          style={styles.input}
          placeholder="Username Petugas"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
        />
        <View style={styles.passwordContainer}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
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

      <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 10 }]}>Daftar Petugas:</Text>
      
      {/* --- INI PERBAIKAN UTAMANYA (extraData) --- */}
      <FlatList
        data={users}
        extraData={visiblePasswordMap} // <<-- KUNCI AGAR TOMBOL MATA BERFUNGSI
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
            const isPasswordVisible = visiblePasswordMap[item.id] || false;
            // Cek apakah password ada isinya, jika tidak tampilkan '(Kosong)'
            const displayPassword = item.password ? item.password : '(Kosong)';

            return (
              <View style={styles.userItem}>
                <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
                    <View style={styles.avatar}>
                        <Text style={{color:'white', fontWeight:'bold'}}>
                          {item.username ? item.username.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                    
                    <View style={{justifyContent:'center'}}>
                        <Text style={styles.userName}>{item.username}</Text>
                        
                        <TouchableOpacity 
                            style={{flexDirection:'row', alignItems:'center', marginTop: 5, padding: 5}} 
                            onPress={() => toggleRowPassword(item.id)}
                        >
                            <Text style={{color:'#666', fontSize: 13, marginRight: 8, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined}}>
                                {isPasswordVisible ? displayPassword : '••••••'}
                            </Text>
                            <Ionicons 
                                name={isPasswordVisible ? "eye-off" : "eye"} 
                                size={18} 
                                color="#1D5D5D" 
                            />
                        </TouchableOpacity>
                    </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity 
                        onPress={() => openEditModal(item)} 
                        style={[styles.actionButton, { backgroundColor: '#f39c12' }]}
                    >
                        <Ionicons name="pencil" size={16} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => handleDeleteUser(item.id, item.username)} 
                        style={[styles.actionButton, { backgroundColor: '#ff6b6b' }]}
                    >
                        <Ionicons name="trash" size={16} color="white" />
                    </TouchableOpacity>
                </View>
              </View>
            );
        }}
        ListEmptyComponent={<Text style={{textAlign:'center', color:'#888'}}>Belum ada data.</Text>}
      />

      {/* MODAL EDIT SAMA SEPERTI SEBELUMNYA */}
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
                        <Text style={styles.btnText}>Simpan</Text>
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
  
  input: { borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', padding: 12, marginBottom: 15, borderRadius: 8 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fbfbfb', borderRadius: 8, marginBottom: 15 },
  inputPassword: { flex: 1, padding: 12 },
  eyeIcon: { padding: 10 },

  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  avatar: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#3498db', justifyContent:'center', alignItems:'center', marginRight: 10 },
  userName: { fontSize: 16, fontWeight: '500', color: '#333' },
  
  actionButton: { padding: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },

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