// Layout.tsx
import React, { useCallback } from 'react';
import { View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

// cegah splash auto hide sampai fonts siap
SplashScreen.preventAutoHideAsync().catch(() => {});

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  // load font FontAwesome untuk tab icons
  const [fontsLoaded] = useFonts({
    ...FontAwesome.font,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Tabs>
        <Tabs.Screen
          name="pencatatan"
          options={{
            title: 'Input Data',
            tabBarIcon: ({ color }) => <TabBarIcon name="edit" color={color} />,
          }}
        />
        <Tabs.Screen
          name="tentang"
          options={{
            title: 'Tentang',
            tabBarIcon: ({ color }) => <TabBarIcon name="info-circle" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
