import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme';

function TabIcon({ icon, focused, color }: { icon: string; focused: boolean; color: string }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{icon}</Text>
    </View>
  );
}

export default function MinistryLayout() {
  const palette = useTheme((s: any) => s.palette);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: palette.neon,
      tabBarInactiveTintColor: palette.textDim,
      tabBarStyle: { backgroundColor: palette.obsidian, borderTopWidth: 1, borderTopColor: palette.border, height: 88, paddingTop: 12, paddingBottom: 32 },
      tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'DASHBOARD', tabBarIcon: ({ focused, color }) => <TabIcon icon="📊" focused={focused} color={color} /> }} />
      <Tabs.Screen name="farmers" options={{ title: 'FARMERS', tabBarIcon: ({ focused, color }) => <TabIcon icon="👥" focused={focused} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'MAP', tabBarIcon: ({ focused, color }) => <TabIcon icon="🗺️" focused={focused} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFILE', tabBarIcon: ({ focused, color }) => <TabIcon icon="P" focused={focused} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 40, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconWrapActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  icon: { fontSize: 16, fontWeight: '900' },
});
