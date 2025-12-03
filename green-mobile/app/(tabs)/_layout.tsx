import { Tabs } from 'expo-router';
import React from 'react';
import { Image } from 'react-native'; // 1. Pastikan Image diimport

// 2. Komponen Icon Khusus Gambar PNG
function TabBarIcon({ source, color }: { source: any, color: string }) {
  return (
    <Image 
      source={source} 
      style={{ 
        width: 24, 
        height: 24, 
        tintColor: color, // Ini yang mengubah warna jadi hijau/abu otomatis
        marginBottom: -3 
      }} 
      resizeMode="contain"
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#1D5D50' }}>
      <Tabs.Screen
        name="pencatatan"
        options={{
          title: 'Input Data',
          // 3. Panggil file PNG 'edit.png'
          tabBarIcon: ({ color }) => <TabBarIcon source={require('../../assets/images/edit.png')} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tentang"
        options={{
          title: 'Tentang',
          // 4. Panggil file PNG 'info.png'
          tabBarIcon: ({ color }) => <TabBarIcon source={require('../../assets/images/info.png')} color={color} />,
        }}
      />
    </Tabs>
  );
}