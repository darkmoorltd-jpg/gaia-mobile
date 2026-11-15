import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminDrivers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [drivers, setDrivers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    // Join drivers with their vehicles and user_profiles
    const { data } = await supabase.from('driver_profiles')
      .select('*, user_profiles(first_name, last_name, phone), vehicles(*)');
    if (data) setDrivers(data);
    setBusy(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateStatus = async (userId: string, status: string) => {
    await supabase.from('driver_profiles').update({ status }).eq('user_id', userId);
    load();
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Management</Text>
        
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {drivers.map((d) => {
          const profile = d.user_profiles || {};
          const vehicle = d.vehicles?.[0] || {};
          return (
            <View key={d.user_id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{profile.first_name} {profile.last_name}</Text>
                <Text style={[styles.status, { color: d.status === 'active' ? palette.neon : '#ffb300' }]}>
                  {d.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.meta}>Phone: {profile.phone}</Text>
              <Text style={styles.meta}>License: {d.license_number}</Text>
              <Text style={styles.meta}>Vehicle: {vehicle.plate_number} ({vehicle.capacity_tonnes} tonnes)</Text>
              
              {d.status === 'pending' ? (
                <View style={styles.actions}>
                  <Pressable onPress={() => updateStatus(d.user_id, 'active')} style={[styles.btn, { backgroundColor: palette.neon }]}>
                    <Text style={[styles.btnText, { color: '#000' }]}>APPROVE</Text>
                  </Pressable>
                  <Pressable onPress={() => updateStatus(d.user_id, 'suspended')} style={[styles.btn, { backgroundColor: '#ff3b5c' }]}>
                    <Text style={styles.btnText}>REJECT</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '800', color: p.text },
  status: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
