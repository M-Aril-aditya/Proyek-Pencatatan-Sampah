import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TentangScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="leaf-circle" size={60} color="#1D5D50" />
        <Text style={styles.title}>Tentang Aplikasi Green</Text>
      </View>
      <Text style={styles.paragraph}>
        Aplikasi <Text style={{fontWeight: 'bold'}}>Green</Text> dirancang untuk mempermudah proses pencatatan sampah harian oleh petugas di lapangan. Dengan aplikasi ini, setiap jenis sampah dapat dicatat beratnya secara akurat, terorganisir berdasarkan kategori Sampah Terkelola Dan Tidak Terkelola.
      </Text>
      <Text style={styles.paragraph}>
        Data yang terkumpul dapat diekspor ke dalam format CSV, menyediakan laporan yang terstruktur untuk analisis lebih lanjut. Tujuan utama kami adalah mendukung manajemen sampah yang lebih efisien dan berbasis data untuk lingkungan yang lebih bersih dan sehat.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 25,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D5D50',
    marginTop: 15,
  },
  paragraph: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 15,
    textAlign: 'justify',
  },
});