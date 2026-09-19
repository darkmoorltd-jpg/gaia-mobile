import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminFarmers() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await supabase
        .from('farmer_verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data || []);
    } catch {}
    setBusy(false);
  };

  useEffect(() => {
    if (user?.email?.toLowerCase() === ADMIN_EMAIL) load();
  }, [user]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from('farmer_verifications').update({ status }).eq('id', id);
    Alert.alert('Updated', 'Status: ' + status);
    setSelected(null);
    load();
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const hay = ((r.full_name || '') + ' ' + (r.state || '') + ' ' + (r.phone || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  // ===== Detail view =====
  if (selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>{selected.full_name || 'Unknown'}</Text>
          <Text style={styles.sub}>{selected.status || 'pending'}</Text>

          <View style={styles.detailCard}>
            <Text style={styles.detailRow}><Text style={styles.k}>Phone: </Text>{selected.phone || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>State: </Text>{selected.state || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>LGA: </Text>{selected.lga || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Address: </Text>{selected.address || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>BVN: </Text>{selected.bvn || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>NIN: </Text>{selected.nin || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Crop: </Text>{selected.crop || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Farm size: </Text>{selected.farm_size || '—'}</Text>
          </View>

          <Text style={styles.sectionLabel}>DOCUMENTS</Text>
          <View style={styles.photoRow}>
            {selected.id_photo_url ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: selected.id_photo_url }} style={styles.photo} />
                <Text style={styles.photoLbl}>ID DOCUMENT</Text>
              </View>
            ) : <Text style={styles.missing}>No ID photo</Text>}
            {selected.selfie_url ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: selected.selfie_url }} style={styles.photo} />
                <Text style={styles.photoLbl}>SELFIE</Text>
              </View>
            ) : <Text style={styles.missing}>No selfie</Text>}
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={() => setStatus(selected.id, 'approved')} style={styles.approve}>
              <Text style={styles.approveTxt}>APPROVE</Text>
            </Pressable>
            <Pressable onPress={() => setStatus(selected.id, 'rejected')} style={styles.reject}>
              <Text style={styles.rejectTxt}>REJECT</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ===== List view =====
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farmer Database</Text>
        <Text style={styles.sub}>{rows.length} records</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, state, phone…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
          />
        </View>

        {busy ? <Text style={styles.loading}>Loading…</Text> : null}

        {filtered.map((r, i) => {
          const ok = r.status === 'approved';
          const pending = r.status === 'pending' || r.status === 'pending_payment';
          const color = ok ? palette.neon : pending ? palette.warning : palette.danger;
          return (
            <Pressable key={i} onPress={() => setSelected(r)} style={styles.card}>
              {r.selfie_url ? (
                <Image source={{ uri: r.selfie_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: palette.textMuted, fontSize: 10 }}>NO PHOTO</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{r.full_name || 'Unknown'}</Text>
                <Text style={styles.detail} numberOfLines={1}>{r.state || '—'} · {r.phone || '—'}</Text>
                <Text style={[styles.statusTag, { color, borderColor: color }]}>{(r.status || 'pending').toUpperCase()}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}
        {filtered.length === 0 && !busy ? <Text style={styles.loading}>No records.</Text> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  searchWrap: { marginBottom: 16 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: p.text, fontSize: 14 },
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: p.abyss },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  detail: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  statusTag: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden' },
  chev: { fontSize: 22, color: p.textDim },
  detailCard: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  detailRow: { fontSize: 13, color: p.text, marginBottom: 8 },
  k: { color: p.neon, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoWrap: { flex: 1 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: p.abyss },
  photoLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  missing: { flex: 1, fontSize: 12, color: p.textDim, textAlign: 'center', paddingVertical: 30 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  approve: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  approveTxt: { fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  reject: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.danger, alignItems: 'center' },
  rejectTxt: { fontWeight: '900', color: p.danger, letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
