import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../src/theme/ThemeContext';

function TabIcon({ emoji, focused, color, isLight }: any) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        { width: 44, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
        focused && { backgroundColor: palette.neonSoft },
      ]}
    >
      <Text style={{ fontSize: 18, fontWeight: '900', color }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { palette, mode } = useTheme();
  const isLight = mode === 'light';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.neon,
        tabBarInactiveTintColor: palette.textDim,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 88,
          paddingTop: 12,
          paddingBottom: 32,
          elevation: 0,
        },
        tabBarBackground: () =>
          isLight ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: palette.border },
              ]}
            />
          ) : (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'rgba(0,0,0,0.55)', borderTopWidth: 1, borderTopColor: palette.border },
                ]}
              />
            </BlurView>
          ),
        tabBarLabelStyle: {
          fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 4,
        },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'HOME',      tabBarIcon: ({ focused, color }) => <TabIcon emoji="H" focused={focused} color={color} /> }} />
      <Tabs.Screen name="crops"     options={{ title: 'CROPS',     tabBarIcon: ({ focused, color }) => <TabIcon emoji="C" focused={focused} color={color} /> }} />
      <Tabs.Screen name="pests"     options={{ title: 'PESTS',     tabBarIcon: ({ focused, color }) => <TabIcon emoji="P" focused={focused} color={color} /> }} />
      <Tabs.Screen name="soil"      options={{ title: 'SOIL',      tabBarIcon: ({ focused, color }) => <TabIcon emoji="S" focused={focused} color={color} /> }} />
      <Tabs.Screen name="livestock" options={{ title: 'LIVESTOCK', tabBarIcon: ({ focused, color }) => <TabIcon emoji="L" focused={focused} color={color} /> }} />
      <Tabs.Screen name="profile"   options={{ title: 'ME',        tabBarIcon: ({ focused, color }) => <TabIcon emoji="U" focused={focused} color={color} /> }} />
    </Tabs>
  );
}
