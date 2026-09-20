import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

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

  const ITEMS = [
    { label: 'Scan History',       route: '/history' },
    { label: 'Payment History',    route: '/payment-history' },
    { label: 'Wallet',             route: '/wallet' },
    { label: 'Badges',             route: '/badges' },
    { label: 'Verification',       route: '/verification' },
    { label: 'Marketplace',        route: '/marketplace' },
    { label: 'Early Warning',      route: '/early-warning' },
    { label: 'University',         route: '/university' },
    { label: 'Farming Calendar',   route: '/calendar' },
    { label: 'Help and Support',   route: '/help' },
    { label: 'Settings',           route: '/settings' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
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

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{scansRemaining}</Text>
            <Text style={styles.statLbl}>SCANS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{plan[0].toUpperCase()}</Text>
            <Text style={styles.statLbl}>PLAN</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {ITEMS.map((item, i) => (
          <Pressable
            key={i}
            onPress={() => router.push(item.route as any)}
            style={styles.item}
          >
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemChevron}>›</Text>
          </Pressable>
        ))}

        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin' as any)} style={styles.adminItem}>
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminChevron}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
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
    statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    stat: {
      flex: 1, padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    },
    statVal: { fontSize: 22, fontWeight: '900', color: palette.neon },
    statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
    sectionLabel: {
      ...typography.micro, color: palette.textMuted, marginBottom: spacing.sm,
    },
    item: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      marginBottom: spacing.sm,
      borderWidth: 1, borderColor: palette.border,
    },
    itemLabel: { ...typography.body, fontWeight: '600', color: palette.text },
    itemChevron: { fontSize: 22, color: palette.textDim },
    adminItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg, borderRadius: radius.md,
      backgroundColor: 'rgba(255,60,90,0.08)', marginTop: spacing.sm,
      borderWidth: 1.5, borderColor: palette.danger,
    },
    adminLabel: {
      fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: palette.danger,
    },
    adminChevron: { fontSize: 22, color: palette.danger },
    logout: {
      marginTop: spacing.xl, padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1.5, borderColor: palette.danger,
      alignItems: 'center',
    },
    logoutText: { fontSize: 15, fontWeight: '800', color: palette.danger },
  });
