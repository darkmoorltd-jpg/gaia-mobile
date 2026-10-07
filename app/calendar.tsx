import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

interface Activity {
  week: number;
  date?: string;
  type: string;
  title: string;
  activity: string;
  organic?: string | null;
  inorganic?: string | null;
}

interface SavedCalendar {
  id: string;
  crop: string;
  crop_group: string | null;
  planting_date: string;
  location: string;
  hectares: number;
  activity_count: number;
  source: string;
  created_at: string;
}

const CROP_GROUPS: Record<string, { icon: string; color: string; crops: string[] }> = {
  'Cereals':         { icon: 'C', color: '#ffb300', crops: ['Maize', 'Rice', 'Wheat', 'Sorghum', 'Millet', 'Barley', 'Fonio'] },
  'Vegetables':      { icon: 'V', color: '#4caf50', crops: ['Tomato', 'Pepper', 'Cabbage', 'Lettuce', 'Spinach', 'Onion', 'Carrot', 'Cucumber', 'Okra', 'Amaranth'] },
  'Fruits':          { icon: 'F', color: '#e91e63', crops: ['Banana', 'Mango', 'Pineapple', 'Watermelon', 'Papaya', 'Orange', 'Avocado'] },
  'Legumes':         { icon: 'L', color: '#795548', crops: ['Beans', 'Cowpea', 'Soybean', 'Groundnut', 'Pigeon Pea'] },
  'Roots & Tubers':  { icon: 'R', color: '#ff9800', crops: ['Cassava', 'Yam', 'Potato', 'Sweet Potato', 'Cocoyam', 'Ginger'] },
  'Oil Crops':       { icon: 'O', color: '#fdd835', crops: ['Sunflower', 'Sesame', 'Oil Palm', 'Coconut', 'Castor'] },
  'Fibre Crops':     { icon: 'X', color: '#9e9e9e', crops: ['Cotton', 'Jute', 'Kenaf', 'Sisal'] },
  'Spices & Herbs':  { icon: 'S', color: '#689f38', crops: ['Basil', 'Mint', 'Thyme', 'Coriander', 'Parsley', 'Lemongrass'] },
};

const TYPE_META: Record<string, { icon: string; color: string }> = {
  land:       { icon: '1', color: '#8d6e63' },
  planting:   { icon: '2', color: '#2e7d32' },
  fertilizer: { icon: 'F', color: '#ff9800' },
  pest:       { icon: 'P', color: '#f44336' },
  disease:    { icon: 'D', color: '#e91e63' },
  water:      { icon: 'W', color: '#2196f3' },
  weed:       { icon: 'w', color: '#4caf50' },
  harvest:    { icon: 'H', color: '#ffb300' },
  postharvest:{ icon: 'S', color: '#795548' },
  crop:       { icon: 'C', color: '#689f38' },
};

export default function Calendar() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);

  const [step, setStep] = useState<'group' | 'crop' | 'form' | 'result'>('group');
  const [group, setGroup] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [plantingDate, setPlantingDate] = useState<string>(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  });
  const [location, setLocation] = useState('');
  const [hectares, setHectares] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [resultMeta, setResultMeta] = useState<any>(null);
  const [saved, setSaved] = useState<SavedCalendar[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await supabase.rpc('my_calendars');
      setSaved(r.data || []);
    } catch {}
    setBusy(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    if (!crop || !plantingDate || !location.trim()) {
      Alert.alert('Missing info', 'Enter a crop, date, and location.');
      return;
    }
    setGenerating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch(API_BASE + '/calendar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          crop,
          crop_group: group,
          planting_date: plantingDate,
          location: location.trim(),
          hectares: parseFloat(hectares) || 1,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Generation failed');
      setActivities(d.activities || []);
      setResultMeta(d);
      setStep('result');
    } catch (e: any) {
      Alert.alert('Could not generate', e?.message || 'Try again');
    } finally {
      setGenerating(false);
    }
  };

  const saveToDb = async () => {
    if (!user || activities.length === 0) return;
    setSaving(true);
    try {
      await supabase.from('farming_calendar').insert({
        user_id: user.id,
        crop,
        crop_group: group,
        planting_date: plantingDate,
        location: location.trim(),
        lat: resultMeta?.lat ?? null,
        lon: resultMeta?.lon ?? null,
        hectares: parseFloat(hectares) || 1,
        activities,
        source: resultMeta?.source || 'ai',
      });
      Alert.alert('Saved', 'Calendar added to your farm log.');
      load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const openSaved = async (s: SavedCalendar) => {
    const { data } = await supabase
      .from('farming_calendar')
      .select('*')
      .eq('id', s.id)
      .single();
    if (!data) { Alert.alert('Not found'); return; }
    setCrop(data.crop);
    setGroup(data.crop_group);
    setPlantingDate(data.planting_date);
    setLocation(data.location || '');
    setHectares(String(data.hectares || 1));
    setActivities((data.activities as Activity[]) || []);
    setResultMeta({ source: data.source, lat: data.lat, lon: data.lon });
    setStep('result');
  };

  const deleteSaved = (s: SavedCalendar) => {
    Alert.alert('Delete calendar?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('farming_calendar').delete().eq('id', s.id);
        load();
      }},
    ]);
  };

  const reset = () => {
    setStep('group');
    setGroup(null);
    setCrop(null);
    setActivities([]);
    setResultMeta(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => step === 'group' ? router.back() : reset()}>
          <Text style={styles.back}>{step === 'group' ? 'BACK' : '< RESTART'}</Text>
        </Pressable>

        <Text style={styles.kicker}>FARMING CALENDAR</Text>
        <Text style={styles.title}>Season Plan</Text>
        <Text style={styles.sub}>AI-generated week-by-week plan with organic and inorganic options</Text>

        {step === 'group' ? (
          <>
            <Text style={styles.sectionLabel}>CHOOSE CROP GROUP</Text>
            <View style={styles.groupGrid}>
              {Object.entries(CROP_GROUPS).map(([name, g]) => (
                <Pressable
                  key={name}
                  onPress={() => { setGroup(name); setStep('crop'); }}
                  style={[styles.groupCard, { borderColor: g.color }]}
                >
                  <View style={[styles.groupIcon, { backgroundColor: g.color + '25', borderColor: g.color }]}>
                    <Text style={[styles.groupIconText, { color: g.color }]}>{g.icon}</Text>
                  </View>
                  <Text style={styles.groupName}>{name}</Text>
                  <Text style={styles.groupCount}>{g.crops.length} crops</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {step === 'crop' && group ? (
          <>
            <Text style={styles.sectionLabel}>{group.toUpperCase()} — PICK A CROP</Text>
            <View style={styles.cropGrid}>
              {CROP_GROUPS[group].crops.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => { setCrop(c); setStep('form'); }}
                  style={[styles.cropChip, { borderColor: CROP_GROUPS[group].color }]}
                >
                  <Text style={[styles.cropChipText, { color: CROP_GROUPS[group].color }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {step === 'form' && crop ? (
          <>
            <Text style={styles.sectionLabel}>{crop.toUpperCase()} — ENTER DETAILS</Text>

            <Text style={styles.label}>PLANTING DATE</Text>
            <TextInput
              value={plantingDate}
              onChangeText={setPlantingDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>LOCATION</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Zaria, Kaduna"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>FARM SIZE (HECTARES)</Text>
            <TextInput
              value={hectares}
              onChangeText={setHectares}
              keyboardType="decimal-pad"
              placeholder="1.0"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Pressable onPress={generate} disabled={generating} style={[styles.primaryBtn, generating && { opacity: 0.5 }]}>
              {generating ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>GENERATE CALENDAR</Text>}
            </Pressable>

            {generating ? (
              <Text style={styles.hintText}>Geocoding, fetching climate, and asking GAIA. This takes 15-25s.</Text>
            ) : null}
          </>
        ) : null}

        {step === 'result' && activities.length > 0 ? (
          <>
            <View style={styles.resultHead}>
              <View>
                <Text style={styles.resultCrop}>{crop}</Text>
                <Text style={styles.resultMeta}>
                  {location} · {hectares} ha · planted {plantingDate}
                </Text>
              </View>
              <View style={[styles.sourcePill, resultMeta?.source === 'ai' ? { backgroundColor: '#00ff8820', borderColor: '#00ff88' } : { backgroundColor: '#ffb30020', borderColor: '#ffb300' }]}>
                <Text style={[styles.sourcePillText, { color: resultMeta?.source === 'ai' ? '#00ff88' : '#ffb300' }]}>
                  {String(resultMeta?.source || 'ai').toUpperCase()}
                </Text>
              </View>
            </View>

            <Pressable onPress={saveToDb} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE TO MY CALENDARS</Text>}
            </Pressable>

            {activities.map((a, i) => {
              const meta = TYPE_META[a.type] || { icon: '·', color: '#8899a6' };
              return (
                <View key={i} style={[styles.actCard, { borderLeftColor: meta.color }]}>
                  <View style={styles.actHead}>
                    <View style={[styles.actBadge, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
                      <Text style={[styles.actBadgeText, { color: meta.color }]}>{String(a.type).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.actWeek}>W{a.week}{a.date ? ' · ' + a.date : ''}</Text>
                  </View>
                  <Text style={styles.actTitle}>{a.title}</Text>
                  <Text style={styles.actBody}>{a.activity}</Text>

                  {a.organic ? (
                    <View style={[styles.solutionBox, { borderLeftColor: '#4caf50' }]}>
                      <Text style={[styles.solutionLabel, { color: '#4caf50' }]}>ORGANIC</Text>
                      <Text style={styles.solutionText}>{a.organic}</Text>
                    </View>
                  ) : null}

                  {a.inorganic ? (
                    <View style={[styles.solutionBox, { borderLeftColor: '#ff9800' }]}>
                      <Text style={[styles.solutionLabel, { color: '#ff9800' }]}>INORGANIC / CHEMICAL</Text>
                      <Text style={styles.solutionText}>{a.inorganic}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {busy && saved.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {saved.length > 0 && step === 'group' ? (
          <>
            <Text style={styles.sectionLabel}>MY SAVED CALENDARS</Text>
            {saved.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => openSaved(s)}
                onLongPress={() => deleteSaved(s)}
                delayLongPress={400}
                style={styles.savedCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCrop}>{s.crop}</Text>
                  <Text style={styles.savedMeta}>
                    {s.location} · {s.hectares} ha · {s.activity_count} activities
                  </Text>
                  <Text style={styles.savedMeta}>
                    Planted {new Date(s.planting_date).toLocaleDateString()} · {String(s.source).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.chev}>{'>'}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groupCard: { width: '48%', padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, alignItems: 'center' },
  groupIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  groupIconText: { fontSize: 20, fontWeight: '900' },
  groupName: { fontSize: 12, fontWeight: '800', color: p.text, textAlign: 'center' },
  groupCount: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  cropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cropChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: p.surface },
  cropChipText: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  primaryBtn: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  hintText: { fontSize: 11, color: p.textMuted, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  resultCrop: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  resultMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  sourcePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  sourcePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  saveBtn: { padding: 14, borderRadius: 12, backgroundColor: '#00ff88', alignItems: 'center', marginBottom: 16 },
  saveBtnText: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1.2 },
  actCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  actHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  actBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  actBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  actWeek: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  actTitle: { fontSize: 15, fontWeight: '800', color: p.text, marginBottom: 6 },
  actBody: { fontSize: 13, color: p.text, lineHeight: 18, marginBottom: 10 },
  solutionBox: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderLeftWidth: 3, marginTop: 8 },
  solutionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  solutionText: { fontSize: 12, color: p.text, lineHeight: 17 },
  savedCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  savedCrop: { fontSize: 14, fontWeight: '900', color: p.text },
  savedMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chev: { fontSize: 22, color: p.textDim },
});
