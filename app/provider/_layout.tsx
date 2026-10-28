import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';

function TabIcon({ emoji, focused, color }: { emoji: string; focused: boolean; color: ColorValue }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{emoji}</Text>
    </View>
  );
}

export default function ProviderLayout() {
  const palette = useTheme((s) => s.palette);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.neon,
        tabBarInactiveTintColor: palette.textDim,
        tabBarStyle: {
          backgroundColor: palette.obsidian, borderTopWidth: 1, borderTopColor: palette.border,
          height: 88, paddingTop: 12, paddingBottom: 32,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'HOME',
        tabBarIcon: ({ focused, color }) => <TabIcon emoji="H" focused={focused} color={color} /> }} />
      <Tabs.Screen name="products" options={{ title: 'PRODUCTS',
        tabBarIcon: ({ focused, color }) => <TabIcon emoji="P" focused={focused} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'ORDERS',
        tabBarIcon: ({ focused, color }) => <TabIcon emoji="O" focused={focused} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'BUSINESS',
        tabBarIcon: ({ focused, color }) => <TabIcon emoji="B" focused={focused} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 40, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconWrapActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  icon: { fontSize: 18, fontWeight: '900' },
});
