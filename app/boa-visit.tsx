import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function BoaVisit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmer?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [search, setSearch] = useState('');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [cashCollected, setCashCollected] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const loadBorrowers = useCallback(async () => {
    const { data } = await supabase.rpc('boa_list_borrowers', {
      p_search: null, p_bucket: 'all', p_zone: null, p_limit: 100,
    });
    setBorrowers(data || []);
  }, []);

  useEffect(() => { loadBorrowers(); }, [loadBorrowers]);

  useEffect(() => {
    if (params.farmer && borrowers.length > 0) {
      const found = borrowers.find((b) => b.user_id === params.farmer);
      if (found) setSelected(found);
    }
  }, [params.farmer, borrowers]);

  const captureVisit = async () => {
    if (!selected) { Alert.alert('Select a farmer first'); return; }
    setCapturing(true); setResult(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Location permission required'); setCapturing(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data, error } = await supabase.rpc('boa_log_field_visit', {
        p_borrower_id: selected.user_id,
        p_lat: loc.coords.latitude,
        p_lng: loc.coords.longitude,
        p_photo_url: null,
        p_notes: notes || null, 
        p_cash_collected: parseFloat(cashCollected) || 0,
      });
      if (error) { Alert.alert('Failed', error.message); setCapturing(false); return; }
      setResult(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Visit logging failed');
    } finally {
      setCapturing(false);
    }
  };

  const filtered = search.trim()
    ? borrowers.filter((b) => ((b.name || '') + ' ' + (b.email || '')).toLowerCase().includes(search.toLowerCase()))
    : borrowers;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Field Visit</Text>
        <Text style={styles.sub}>Capture your GPS to verify the visit against the farmer's farm pin</Text>

        {!selected ? (
          <>
            <TextInput value={search} onChangeText={setSearch}
              placeholder="Search farmers..." placeholderTextColor={palette.textDim}
              style={styles.input} autoCapitalize="none" />
            {filtered.length === 0 ? (
              <Text style={styles.empty}>No borrowers found.</Text>
            ) : filtered.map((b) => (
              <Pressable key={b.user_id} onPress={() => setSelected(b)} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(b.name || b.email || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{b.name || b.email}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{b.zone || '-'} · {b.crop || '-'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.selectedCard}>
              <Text style={styles.selectedLabel}>VISITING</Text>
              <Text style={styles.selectedName} numberOfLines={1}>{selected.name || selected.email}</Text>
              <Text style={styles.selectedMeta}>{selected.zone || '-'} · {selected.crop || '-'}</Text>
              <Pressable onPress={() => { setSelected(null); setResult(null); setNotes(''); setCashCollected(''); }} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>CHANGE FARMER</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>VISIT NOTES</Text>
            <TextInput value={notes} onChangeText={setNotes} multiline
              placeholder="What did you observe on the farm? Crop condition, pest sightings, etc."
              placeholderTextColor={palette.textDim}
              style={[styles.input, { minHeight: 100 }]} />

            <Text style={styles.label}>CASH COLLECTED (₦)</Text>
            <TextInput value={cashCollected} onChangeText={setCashCollected} keyboardType="numeric"
              placeholder="e.g. 15000" placeholderTextColor={palette.textDim} style={styles.input} />

            <Pressable onPress={captureVisit} disabled={capturing} style={styles.cta}>
              {capturing ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>📸 CAPTURE GPS & LOG VISIT</Text>}
            </Pressable>

            {result ? (
              <View style={[styles.resultCard, { borderColor: result.ok && result.verified ? '#00ff88' : '#ffb300' }]}>
                <Text style={[styles.resultTitle, { color: result.ok && result.verified ? '#00ff88' : '#ffb300' }]}>
                  {result.ok && result.verified ? '✅ VISIT VERIFIED' : '⚠️ VISIT LOGGED (UNVERIFIED)'}
                </Text>
                {result.ok ? (
                  <>
                    <Text style={styles.resultText}>Distance from farm pin: {result.distance_m} m</Text>
                    <Text style={styles.resultText}>
                      {result.verified
                        ? 'You are within 200m of the farm — visit verified.'
                        : 'You are more than 200m from the farm pin. Visit logged but not verified.'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.resultText}>{result.message}</Text>
                )}
              </View>
            ) : null}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 12 },
  empty: { fontSize: 12, color: p.textMuted, textAlign: 'center', padding: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: p.neon },
  rowName: { fontSize: 14, fontWeight: '800', color: p.text },
  rowMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: p.textDim },
  selectedCard: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon, marginBottom: 16 },
  selectedLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 2, color: p.neon },
  selectedName: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 4 },
  selectedMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  changeBtn: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: p.border, alignSelf: 'flex-start' },
  changeBtnText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  resultCard: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5 },
  resultTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  resultText: { fontSize: 13, color: p.text, marginBottom: 4 },
});
