import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { palette } from '../../src/theme';

function TabIcon({ emoji, focused, color }: any) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
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
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={styles.tabBarOverlay} />
          </BlurView>
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="H" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="crops"
        options={{
          title: 'CROPS',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="C" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pests"
        options={{
          title: 'PESTS',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="P" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="soil"
        options={{
          title: 'SOIL',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="S" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="livestock"
        options={{
          title: 'LIVESTOCK',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="L" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ME',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="U" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: palette.neonSoft,
  },
  icon: { fontSize: 18, fontWeight: '900' },
});
