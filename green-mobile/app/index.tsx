import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import axios from 'axios'; // Pastikan sudah install: npm install axios
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// LINK BACKEND VERCEL ANDA
const API_URL = 'https://proyek-pencatatan-sampah.vercel.app/api'; 

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Cek Admin (Hardcode - Sesuai request awal)
    if (username === 'admin' && password === '@dexazerowaste2030') {
      router.replace('/admin');
      return;
    }

    // 2. Cek Input Kosong
    if (!username || !password) {
      Alert.alert('Gagal', 'Username dan Password wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      console.log('Mencoba login ke:', `${API_URL}/login-petugas`);
      
      // Kirim data ke Backend
      const response = await axios.post(`${API_URL}/login-petugas`, {
        username: username,
        password: password
      });

      console.log('Respon Server:', response.data);
      
      if (response.data.message === 'Login Berhasil') {
        // Masuk ke halaman pencatatan & bawa nama user
        router.replace({ 
            pathname: '/(tabs)/pencatatan', 
            params: { user: response.data.username } 
        });
      } else {
        Alert.alert('Gagal', 'Respon tidak dikenali.');
      }

    } catch (error) {
      // --- PERBAIKAN TYPESCRIPT DI SINI ---
      // Kita ubah tipe 'unknown' menjadi 'any' agar bisa baca .response
      const err = error as any; 

      console.error('Error Login:', err);

      if (err.response) {
        // Server merespon dengan status error (401/404)
        Alert.alert('Gagal Login', err.response.data.message || 'Username/Password Salah');
      } else if (err.request) {
        // Tidak ada respon (Internet mati / Server Down)
        Alert.alert('Koneksi Error', 'Tidak dapat terhubung ke server. Cek internet Anda.');
      } else {
        // Error lainnya
        Alert.alert('Error', 'Terjadi kesalahan sistem.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
           <Image 
             source={require('../assets/images/icon.png')} 
             style={styles.logo} 
             resizeMode="contain" 
           />
           <Text style={styles.title}>Selamat Datang</Text>
           <Text style={styles.subtitle}>Aplikasi Pencatatan Sampah</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          
          {/* Username */}
          <View style={styles.inputWrapper}>
            <Image 
              source={require('../assets/images/user.png')} 
              style={styles.inputIcon}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Nama Pengguna" 
              placeholderTextColor="#aaa"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrapper}>
             <Image 
              source={require('../assets/images/lock.png')} 
              style={styles.inputIcon}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Password" 
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
                {loading ? 'Memuat...' : 'Masuk'}
            </Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D5D50' }, 
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 100, height: 100, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#E0E0E0' },

  formContainer: { width: '100%' },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)', 
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  inputIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
    tintColor: '#ccc' 
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
  },

  button: {
    backgroundColor: 'white',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: '#1D5D50',
    fontSize: 18,
    fontWeight: 'bold',
  },
});