import { Stack } from 'expo-router';
import React from 'react';

// Pastikan hanya ada komponen Stack dan Screen di sini, tanpa teks atau spasi liar.
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}