import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';
import { useChatStore } from '../../src/store/chat';

function TabIcon({ emoji, focused, color }: {
  emoji: string; focused: boolean; color: ColorValue;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const palette = useTheme((s) => s.palette);
  const unreadTotal = useChatStore((s) => s.unreadTotal);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.neon,
        tabBarInactiveTintColor: palette.textDim,
        tabBarStyle: {
          backgroundColor: palette.obsidian,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          height: 88,
          paddingTop: 12,
          paddingBottom: 32,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
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
        name="chat"
        options={{
          title: 'CHAT',
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ff3b5c', color: '#fff', fontSize: 10, fontWeight: '900' },
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="M" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(0,255,136,0.12)',
  },
  icon: { fontSize: 20, fontWeight: '900' },
});
