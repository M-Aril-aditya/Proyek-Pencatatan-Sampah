import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image, // 1. Pastikan Image diimport
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// KUNCI PENYIMPANAN SAMA
export const USER_STORAGE_KEY = 'waste_users_v2'; 

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (username === 'admin' && password === '@dexazerowaste2030') {
      router.replace('/admin');
      return;
    }

    try {
      const usersString = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const users = usersString ? JSON.parse(usersString) : [];
      
      const foundUser = users.find((u: any) => u.fullName.toLowerCase() === username.toLowerCase());

      if (foundUser) {
        if (foundUser.password === password) {
          router.replace({ pathname: '/(tabs)/pencatatan', params: { user: foundUser.fullName } });
        } else {
          Alert.alert('Gagal', 'Password salah untuk petugas ini.');
        }
      } else {
        Alert.alert('Gagal', 'Nama petugas tidak ditemukan. Hubungi Admin.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Terjadi kesalahan sistem.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Logo / Header */}
        <View style={styles.headerContainer}>
           {/* Gunakan Logo Daun Anda di sini */}
           <Image 
              source={require('../assets/images/icon.png')} 
              style={styles.logo} 
              resizeMode="contain" 
           />
           <Text style={styles.title}>Selamat Datang</Text>
           <Text style={styles.subtitle}>Aplikasi Pencatatan Sampah</Text>
        </View>

        {/* Form Login */}
        <View style={styles.formContainer}>
          
          {/* Input Username */}
          <View style={styles.inputWrapper}>
            {/* ICON USER (PNG) */}
            <Image 
              source={require('../assets/images/user.png')} // Ganti 'icon.png' jika user.png tidak ada
              style={styles.inputIcon}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Nama Pengguna atau Admin" 
              placeholderTextColor="#aaa"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Input Password */}
          <View style={styles.inputWrapper}>
             {/* ICON LOCK (PNG) */}
             <Image 
              source={require('../assets/images/lock.png')} // Ganti 'icon.png' jika lock.png tidak ada
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

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Masuk</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D5D50' }, // Warna Hijau background
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 100, height: 100, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#E0E0E0' },

  formContainer: { width: '100%' },
  
  // Style Baru untuk Input dengan Icon
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Putih transparan
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
    tintColor: '#ccc' // Warna ikon jadi abu-abu terang
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