import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 60,
          backgroundColor: '#1f2937',
          borderTopWidth: 0
        },
        tabBarItemStyle: {
          paddingVertical: 8
        },
        tabBarLabelStyle: {
          fontSize: 12
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Navigation',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="map" size={24} color={color} />
          ),
          tabBarActiveTintColor: '#0ea5e9',
          tabBarInactiveTintColor: '#9ca3af',
        }}
      />
    </Tabs>
  );
}