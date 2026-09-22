import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

interface MenuItem {
  label: string;
  route: string;
  badge?: string;
}

interface Section {
  title: string;
  icon: string;
  items: MenuItem[];
}

const SECTIONS: Section[] = [
  {
    title: 'SCANS & AI',
    icon: 'AI',
    items: [
      { label: 'Voice Agronomist',   route: '/voice' },
      { label: 'Video Scan',         route: '/video-scan' },
      { label: 'Scan History',       route: '/history' },
      { label: 'Early Warning',      route: '/early-warning' },
    ],
  },
  {
    title: 'FARM TOOLS',
    icon: 'FM',
    items: [
      { label: 'Farm Mapping',       route: '/farm-mapping' },
      { label: 'Yield Estimator',    route: '/yield-estimator' },
      { label: 'Fertilizer Calculator', route: '/input-calculator' },
      { label: 'Profit Calculator',  route: '/profit-calculator' },
      { label: 'Planting Calendar',  route: '/planting-calendar' },
      { label: 'Seed Recommender',   route: '/seed-recommender' },
      { label: 'Farm Journal',       route: '/journal' },
      { label: 'Satellite Monitor',  route: '/satellite' },
    ],
  },
  {
    title: 'MONEY & BUSINESS',
    icon: '$$',
    items: [
      { label: 'Wallet',             route: '/wallet' },
      { label: 'Payment History',    route: '/payment-history' },
      { label: 'Savings Groups',     route: '/savings-groups' },
      { label: 'Rewards & Referral', route: '/rewards' },
      { label: 'Affiliate Program',  route: '/affiliate' },
      { label: 'B2B Dashboard',      route: '/b2b-dashboard' },
      { label: 'Sponsored Ads',      route: '/ads' },
    ],
  },
  {
    title: 'COMMUNITY',
    icon: 'CM',
    items: [
      { label: 'Marketplace',        route: '/marketplace' },
      { label: 'University',         route: '/university' },
      { label: 'Chat',               route: '/chat' },
      { label: 'GAIA Meet',          route: '/meet' },
      { label: 'Notifications',      route: '/notifications' },
    ],
  },
  {
    title: 'ACCOUNT',
    icon: 'AC',
    items: [
      { label: 'Verification',       route: '/verification' },
      { label: 'Badges',             route: '/badges' },
      { label: 'Farming Calendar',   route: '/calendar' },
    ],
  },
  {
    title: 'SUPPORT',
    icon: 'SP',
    items: [
      { label: 'Help and Support',   route: '/help' },
      { label: 'Settings',           route: '/settings' },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, scansRemaining, plan, signOut } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('avatar_url,first_name,last_name,email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setAvatar(data.avatar_url || null);
      const n = ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      setName(n || (data.email ? data.email.split('@')[0] : 'Farmer'));
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const uploadAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !user) return;

    setBusy(true);
    try {
      const asset = res.assets[0];
      const response = await fetch(asset.uri);
      const arrayBuffer = await new Response(response.body ?? response).arrayBuffer();
      const path = user.id + '/' + Date.now() + '.jpg';

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;

      await supabase
        .from('user_profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      setAvatar(url);
      Alert.alert('Success', 'Profile picture updated');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- HERO ---------- */}
        <View style={styles.hero}>
          <Pressable onPress={uploadAvatar} style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {(name || user?.email || 'F').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {busy ? (
                <ActivityIndicator color={palette.obsidian} size="small" />
              ) : (
                <Text style={styles.avatarEditText}>+</Text>
              )}
            </View>
          </Pressable>

          <Text style={styles.name}>{name || user?.email?.split('@')[0]}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* ---------- STATS ---------- */}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{scansRemaining}</Text>
            <Text style={styles.statLbl}>SCANS LEFT</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{plan[0].toUpperCase()}</Text>
            <Text style={styles.statLbl}>PLAN</Text>
          </View>
        </View>

        {/* ---------- SECTIONS ---------- */}
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            <View style={styles.sectionItems}>
              {section.items.map((item, ii) => (
                <Pressable
                  key={ii}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.item,
                    ii === section.items.length - 1 && styles.itemLast,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.badge ? (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.itemChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* ---------- ADMIN ---------- */}
        {isAdmin ? (
          <Pressable
            onPress={() => router.push('/admin' as any)}
            style={styles.adminItem}
          >
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminChevron}>›</Text>
          </Pressable>
        ) : null}

        {/* ---------- LOGOUT ---------- */}
        <Pressable onPress={() => signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>GAIA Mobile v1.0.0</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },

    // Hero
    hero: { alignItems: 'center', marginBottom: spacing.xl },
    avatarWrap: { width: 110, height: 110, position: 'relative' },
    avatarImg: { width: 110, height: 110, borderRadius: 55 },
    avatarFallback: {
      width: 110, height: 110, borderRadius: 55,
      backgroundColor: palette.neonSoft,
      borderWidth: 2, borderColor: palette.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 44, fontWeight: '900', color: palette.neon },
    avatarEdit: {
      position: 'absolute', bottom: 0, right: 0,
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: palette.neon,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: palette.obsidian,
    },
    avatarEditText: {
      fontSize: 20, fontWeight: '900',
      color: palette.obsidian, lineHeight: 22,
    },
    name: {
      fontSize: 24, fontWeight: '900', color: palette.text,
      marginTop: spacing.md, textTransform: 'capitalize', letterSpacing: -0.5,
    },
    email: { fontSize: 14, color: palette.textMuted, marginTop: 4 },

    // Stats
    statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    stat: {
      flex: 1, padding: spacing.lg, borderRadius: radius.md,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    },
    statVal: { fontSize: 22, fontWeight: '900', color: palette.neon },
    statLbl: {
      fontSize: 9, fontWeight: '800', letterSpacing: 1.2,
      color: palette.textMuted, marginTop: 4,
    },

    // Sections
    section: { marginBottom: spacing.xl },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center',
      gap: spacing.sm, marginBottom: spacing.md,
    },
    sectionIconWrap: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: palette.neonSoft,
      borderWidth: 1, borderColor: palette.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionIcon: {
      fontSize: 9, fontWeight: '900',
      color: palette.neon, letterSpacing: 0.5,
    },
    sectionTitle: {
      fontSize: 11, fontWeight: '900', letterSpacing: 1.8,
      color: palette.textMuted,
    },

    sectionItems: {
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    itemLast: { borderBottomWidth: 0 },
    itemLabel: {
      flex: 1, fontSize: 14, fontWeight: '600',
      color: palette.text,
    },
    itemChevron: { fontSize: 20, color: palette.textDim },
    itemBadge: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
      backgroundColor: palette.neon, marginRight: 8,
    },
    itemBadgeText: {
      fontSize: 9, fontWeight: '900',
      color: palette.obsidian, letterSpacing: 0.8,
    },

    // Admin
    adminItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg, borderRadius: radius.md,
      backgroundColor: 'rgba(255,60,90,0.08)',
      borderWidth: 1.5, borderColor: palette.danger,
      marginBottom: spacing.lg,
    },
    adminLabel: {
      fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: palette.danger,
    },
    adminChevron: { fontSize: 22, color: palette.danger },

    // Logout
    logout: {
      padding: spacing.lg, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: palette.danger,
      alignItems: 'center',
    },
    logoutText: { fontSize: 15, fontWeight: '800', color: palette.danger },
    version: {
      fontSize: 10, color: palette.textDim,
      textAlign: 'center', marginTop: spacing.xl,
      letterSpacing: 1,
    },
  });
