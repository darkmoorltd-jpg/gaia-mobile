import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function MyData() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: d } = await supabase.rpc('farmer_my_data');
      setData(d);
    } catch {}
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exportData = async () => {
    if (!data) return;
    try {
      const json = JSON.stringify(data, null, 2);
      await Share.share({ message: json, title: 'My GAIA Data' });
    } catch {}
  };

  const requestDeletion = () => {
    Alert.alert(
      'Request account deletion?',
      'Under NDPA 2023, you can request deletion of your data. GAIA will process this within 30 days. Some data may be retained for legal/compliance reasons.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Deletion', style: 'destructive', onPress: async () => {
          setDeleting(true);
          const { error } = await supabase.from('data_deletion_requests').insert({
            user_id: user?.id, reason: 'User-initiated DSAR', status: 'pending',
          });
          setDeleting(false);
          if (error) Alert.alert('Failed', error.message);
          else Alert.alert('Request submitted', 'The GAIA team will process your request within 30 days.');
        }},
      ],
    );
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  const profile = data?.profile || {};
  const registry = data?.registry || {};
  const consent = data?.consent || {};
  const audit = data?.audit || [];
  const grievances = data?.grievances || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Data</Text>
        <Text style={styles.sub}>NDPA 2023 · Right of Access</Text>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <KV k="Email" v={user?.email} styles={styles} />
          <KV k="Name" v={`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '—'} styles={styles} />
          <KV k="Phone" v={profile.phone || '—'} styles={styles} />
          <KV k="State" v={profile.state || '—'} styles={styles} />
          <KV k="LGA" v={profile.lga || '—'} styles={styles} />
          <KV k="NIN" v={registry.nin ? `••••••${registry.nin.slice(-4)}` : '—'} styles={styles} />
          <KV k="NIN Verified" v={registry.nin_verified ? '✅ Yes' : 'No'} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>FARM</Text>
        <View style={styles.card}>
          <KV k="Primary Crop" v={registry.crop || '—'} styles={styles} />
          <KV k="Farm Size" v={registry.farm_size_acres ? `${registry.farm_size_acres} acres` : '—'} styles={styles} />
          <KV k="GPS Point" v={registry.gps_lat ? '📍 Captured' : 'Not captured'} styles={styles} />
          <KV k="Polygon" v={registry.farm_polygon ? '🗺️ Drawn' : 'Not drawn'} styles={styles} />
          <KV k="Land Tenure" v={registry.land_tenure || '—'} styles={styles} />
          <KV k="Cooperative" v={registry.is_coop_member ? 'Yes' : 'No'} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>DATA CONSENT</Text>
        <View style={styles.card}>
          <KV k="NDPA Consent" v={consent.given ? '✅ Given' : 'Not given'} styles={styles} />
          <KV k="Consent Date" v={consent.at ? new Date(consent.at).toLocaleDateString() : '—'} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>CHANGE HISTORY ({audit.length})</Text>
        <View style={styles.card}>
          {audit.length === 0 ? <Text style={styles.empty}>No changes yet.</Text> :
            audit.slice(0, 10).map((a: any, i: number) => (
              <KV key={i} k={a.action} v={new Date(a.at).toLocaleDateString()} styles={styles} />
            ))}
        </View>

        <Text style={styles.sectionLabel}>MY GRIEVANCES ({grievances.length})</Text>
        <View style={styles.card}>
          {grievances.length === 0 ? <Text style={styles.empty}>None.</Text> :
            grievances.map((g: any, i: number) => (
              <Pressable key={i} onPress={() => router.push('/grievance' as any)}>
                <KV k={g.subject} v={g.status.toUpperCase()} styles={styles} />
              </Pressable>
            ))}
        </View>

        <Text style={styles.sectionLabel}>YOUR RIGHTS</Text>
        <Pressable onPress={exportData} style={styles.actionBtn}>
          <Text style={styles.actionTxt}>📥 EXPORT MY DATA</Text>
        </Pressable>
        <Pressable onPress={requestDeletion} disabled={deleting} style={[styles.actionBtn, { borderColor: palette.danger }]}>
          <Text style={[styles.actionTxt, { color: palette.danger }]}>{deleting ? 'REQUESTING…' : '🗑️ REQUEST DELETION'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/grievance' as any)} style={styles.actionBtn}>
          <Text style={styles.actionTxt}>📮 FILE A GRIEVANCE</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function KV({ k, v, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v} numberOfLines={2}>{v ?? '—'}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: p.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  k: { fontSize: 12, color: p.textMuted, flex: 1 },
  v: { fontSize: 12, color: p.text, fontWeight: '700', flex: 1.2, textAlign: 'right' },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  actionBtn: { marginTop: 10, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  actionTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
});
