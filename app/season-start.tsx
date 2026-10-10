import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const CROPS = ['Maize','Rice','Sorghum','Millet','Cowpea (Beans)','Soybean','Groundnut','Tomato','Pepper','Onion','Cassava','Yam','Cabbage'];
const VARIETIES: Record<string,string[]> = {
  'Maize': ['SAMMAZ 52','SAMMAZ 15','Oba Super 2','Oba Super 6','SC 651','Local'],
  'Rice': ['FARO 44','FARO 52','FARO 57','NERICA','Local'],
  'Cowpea (Beans)': ['IT97K-499-35','SAMPEA 11','SAMPEA 14','Local'],
  'Soybean': ['TGX 1448-2E','TGX 1835-10E','Local'],
  'Groundnut': ['SAMNUT 22','SAMNUT 24','Local'],
  'Tomato': ['UC82B','Roma VF','Padma','Local'],
  'Cassava': ['TMS 30572','TME 419','Local'],
  'Yam': ['White yam','Yellow yam','Water yam','Local'],
};

export default function SeasonStart() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [crop, setCrop] = useState('Maize');
  const [variety, setVariety] = useState('');
  const [hectares, setHectares] = useState('1');
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().slice(0, 10));
  const [seedSource, setSeedSource] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!crop || !plantingDate) { Alert.alert('Missing', 'Crop and planting date are required.'); return; }
    const h = parseFloat(hectares);
    setBusy(true);
    const { data, error } = await supabase.rpc('season_create', {
      p_crop: crop,
      p_planting_date: plantingDate,
      p_variety: variety || null,
      p_plot_hectares: isFinite(h) ? h : null,
      p_farm_id: null,
      p_seed_source: seedSource || null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    router.replace('/season' as any);
  };

  const varieties = VARIETIES[crop] || [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Plant a season</Text>
        <Text style={styles.sub}>GAIA will follow this crop from today until you sell it.</Text>

        <Text style={styles.label}>CROP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CROPS.map((c) => (
            <Pressable key={c} onPress={() => { setCrop(c); setVariety(''); }} style={[styles.chip, crop === c && styles.chipOn]}>
              <Text style={[styles.chipTxt, crop === c && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {varieties.length > 0 ? (
          <>
            <Text style={styles.label}>VARIETY (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {varieties.map((v) => (
                <Pressable key={v} onPress={() => setVariety(v)} style={[styles.chip, variety === v && styles.chipOn]}>
                  <Text style={[styles.chipTxt, variety === v && styles.chipTxtOn]}>{v}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.label}>PLOT SIZE (HECTARES)</Text>
        <TextInput value={hectares} onChangeText={setHectares} keyboardType="decimal-pad"
          placeholder="1.5" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>PLANTING DATE</Text>
        <TextInput value={plantingDate} onChangeText={setPlantingDate}
          placeholder="YYYY-MM-DD" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>SEED SOURCE (OPTIONAL)</Text>
        <TextInput value={seedSource} onChangeText={setSeedSource}
          placeholder="e.g. Kaduna agro-dealer" placeholderTextColor={palette.textDim} style={styles.input} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : (
            <Text style={styles.ctaTxt}>START SEASON</Text>
          )}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  chipRow: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.12)' },
  chipTxt: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  chipTxtOn: { color: '#00ff88' },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
});
