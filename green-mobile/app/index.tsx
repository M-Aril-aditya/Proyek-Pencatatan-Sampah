// Index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// IMPORT ICON dan FONT LOADER
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

// cegah splash auto hide sampai fonts siap
SplashScreen.preventAutoHideAsync().catch(() => {});

// Kunci untuk menyimpan daftar user di storage
export const USER_STORAGE_KEY = 'validUsersList';
// Password master untuk admin
const ADMIN_PASSWORD = '@dexagreen123';

// Daftar user awal (hanya untuk migrasi pertama kali)
const INITIAL_USERS = [
  { id: '1', fullName: 'Andi', password: '123' },
  { id: '2', fullName: 'Budi', password: '456' },
  { id: '3', fullName: 'Wati', password: '789' },
];

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  // Load font icon (MaterialCommunityIcons)
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  // sembunyikan splash setelah fonts siap
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const migrateInitialUsers = async () => {
      try {
        const usersString = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!usersString) {
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
          console.log('Migrasi user awal ke AsyncStorage berhasil.');
        }
      } catch (e) {
        console.error('Gagal migrasi user awal:', e);
      }
    };
    migrateInitialUsers();
  }, []);

  const handleLogin = async () => {
    if (name.toLowerCase() === 'admin' && password === ADMIN_PASSWORD) {
      console.log('Login Admin berhasil');
      router.replace('/admin');
      return;
    }

    try {
      const usersString = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!usersString) {
        Alert.alert('Gagal', 'Daftar pengguna tidak ditemukan. Hubungi admin.');
        return;
      }

      const validUsers = JSON.parse(usersString);

      const foundUser = validUsers.find(
        (user: any) => user.fullName.toLowerCase() === name.toLowerCase() && user.password === password
      );

      if (foundUser) {
        router.replace({ pathname: '/(tabs)/pencatatan', params: { user: foundUser.fullName } });
      } else {
        Alert.alert('Gagal', 'Nama atau password salah!');
      }
    } catch (e) {
      console.error('Gagal membaca data user:', e);
      Alert.alert('Error', 'Terjadi kesalahan saat login.');
    }
  };

  // Jangan render UI sampai font ter-load
  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <Text style={styles.title}>Selamat Datang</Text>
      <Text style={styles.subtitle}>Aplikasi Pencatatan Sampah</Text>
      <View style={styles.inputContainer}>
        <MaterialCommunityIcons name="account" size={24} color="#aaa" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Nama Pengguna atau Admin"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.inputContainer}>
        <MaterialCommunityIcons name="lock" size={24} color="#aaa" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          secureTextEntry={true}
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Masuk</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D5D50', alignItems: 'center', justifyContent: 'center', padding: 25 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 10 },
  subtitle: { fontSize: 18, color: '#E0E0E0', marginBottom: 40 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#FFFFFF' },
  button: { width: '100%', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#1D5D50', fontSize: 18, fontWeight: 'bold' },
});
