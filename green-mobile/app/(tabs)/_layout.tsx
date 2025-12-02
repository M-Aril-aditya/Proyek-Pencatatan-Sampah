import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// Komponen tab layout
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="pencatatan"
        options={{
          title: 'Input Data',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="edit" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tentang"
        options={{
          title: 'Tentang',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="info-circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
