import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';
import { useTranslation } from 'react-i18next';

function TabIcon({ emoji, focused, color }: {
  emoji: string; focused: boolean; color: ColorValue;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{emoji}</Text>
    </View>
  );
}

export default function AgentLayout() {
  const { t } = useTranslation();
  const palette = useTheme((s) => s.palette);

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
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('agentTabs.home'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="H" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="farmers"
        options={{
          title: t('agentTabs.farmers'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="F" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          title: t('agentTabs.register'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="+" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t('agentTabs.verify'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="V" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: t('agentTabs.ledger'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="N" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('agentTabs.profile'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="P" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  icon: { fontSize: 18, fontWeight: '900' },
});