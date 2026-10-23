import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';
import { useSettings } from '../../src/store/settings';
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

export default function TabsLayout() {
  const palette = useTheme((s) => s.palette);
  const { t } = useTranslation();
  const flags = useSettings((s) => s.flags);
  const flagOn = (k: string) => (flags[k] === undefined ? true : !!flags[k]);

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
          title: t('tabs.home').toUpperCase(),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="H" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="crops"
        options={{
          title: t('tabs.crops').toUpperCase(),
          href: flagOn('crops') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="C" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pests"
        options={{
          title: t('tabs.pests').toUpperCase(),
          href: flagOn('pests') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="P" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="soil"
        options={{
          title: t('tabs.soil').toUpperCase(),
          href: flagOn('soil') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="S" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="livestock"
        options={{
          title: t('tabs.livestock').toUpperCase(),
          href: flagOn('livestock') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="L" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat').toUpperCase(),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="M" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: (t('tabs.voice') || 'VOICE').toUpperCase(),
          href: flagOn('voice') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="V" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: (t('tabs.profile') || 'PROFILE').toUpperCase(),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="U" focused={focused} color={color} />
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
