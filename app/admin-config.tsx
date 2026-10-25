import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useIsAdmin } from '../src/utils/admin';
import { supabase } from '../src/api/supabase';
import { useSettings } from '../src/store/settings';

const FLAG_KEYS = [
  'crops', 'pests', 'soil', 'livestock', 'marketplace', 'insurance',
  'chat', 'voice', 'video', 'satellite', 'university', 'calendar',
  'wallet', 'badges', 'loans',
];

const FLAG_ICONS: Record<string, string> = {
  crops: '🌾', pests: '🐛', soil: '🏞️', livestock: '🐄', marketplace: '🌍',
  insurance: '🏦', chat: '💬', voice: '🎙️', video: '🎥', satellite: '🛰️',
  university: '🎓', calendar: '📅', wallet: '💰', badges: '🏅', loans: '💳',
};

const REGION_LABELS: Record<string, string> = {
  west_africa: 'West Africa', east_africa: 'East Africa',
  central_africa: 'Central Africa', southern_africa: 'Southern Africa',
  north_africa: 'North Africa', europe: 'Europe',
  north_america: 'North America', south_america: 'South America',
  south_asia: 'South Asia', southeast_asia: 'Southeast Asia',
  east_asia: 'East Asia', middle_east: 'Middle East',
  oceania: 'Oceania',
};

type Tab = 'flags' | 'models' | 'countries';

export default function AdminConfig() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const { isAdmin } = useIsAdmin();

  const [tab, setTab] = useState<Tab>('flags');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [newCrop, setNewCrop] = useState('');
  const [newModel, setNewModel] = useState('');

  const [matrix, setMatrix] = useState<any | null>(null);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
  const [countryFlags, setCountryFlags] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.from('app_settings')
      .select('key,value').in('key', ['feature_flags', 'model_config']);
    (data || []).forEach((r: any) => {
      if (r.key === 'feature_flags') setFlags(r.value || {});
      if (r.key === 'model_config') setModels(r.value || {});
    });
    setBusy(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const loadMatrix = useCallback(async () => {
    if (!isAdmin) return;
    setMatrixBusy(true);
    const { data, error } = await supabase.rpc('admin_country_flag_matrix');
    if (!error && data) setMatrix(data);
    setMatrixBusy(false);
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'countries') loadMatrix();
  }, [tab, loadMatrix]);

  const toggle = async (key: string, value: boolean) => {
    setSaveBusy(true);
    const { error } = await supabase.rpc('admin_set_flag', { p_key: key, p_value: value });
    setSaveBusy(false);
    if (error) Alert.alert('Failed', error.message);
    else {
      setFlags((f) => ({ ...f, [key]: value }));
      await useSettings.getState().load();
    }
  };

  const setModel = async (crop: string, model: string) => {
    if (!crop.trim() || !model.trim()) return;
    setSaveBusy(true);
    const { error } = await supabase.rpc('admin_set_model', {
      p_crop: crop.trim().toLowerCase(), p_model_key: model.trim(),
    });
    setSaveBusy(false);
    if (error) Alert.alert('Failed', error.message);
    else {
      setModels((m) => ({ ...m, [crop.toLowerCase()]: model.trim() }));
      setNewCrop(''); setNewModel('');
      await useSettings.getState().load();
    }
  };

  const openCountry = (country: any) => {
    setSelectedCountry(country);
    const o: Record<string, boolean> = {};
    (matrix?.overrides || []).forEach((row: any) => {
      if (row.country_code === country.code) o[row.feature_key] = !!row.enabled;
    });
    setCountryFlags(o);
  };

  const toggleCountryFlag = async (key: string) => {
    if (!selectedCountry) return;
    const globalVal = matrix?.global_flags?.[key] ?? true;
    const cur = key in countryFlags ? countryFlags[key] : globalVal;
    const next = !cur;

    setCountryFlags((prev) => ({ ...prev, [key]: next }));
    setSaveBusy(true);
    const { error } = await supabase.rpc('admin_set_country_flag', {
      p_country: selectedCountry.code, p_key: key, p_enabled: next,
    });
    setSaveBusy(false);
    if (error) {
      Alert.alert('Failed', error.message);
      setCountryFlags((prev) => {
        const c = { ...prev }; delete c[key]; return c;
      });
    } else {
      await loadMatrix();
      await useSettings.getState().load();
    }
  };

  const resetCountry = () => {
    if (!selectedCountry) return;
    Alert.alert('Reset all overrides?',
      `All country-specific flags for ${selectedCountry.name} will be cleared. Features will fall back to global defaults.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          setSaveBusy(true);
          const { error } = await supabase.rpc('admin_reset_all_country_flags', {
            p_country: selectedCountry.code,
          });
          setSaveBusy(false);
          if (error) Alert.alert('Failed', error.message);
          else {
            setCountryFlags({});
            await loadMatrix();
            await useSettings.getState().load();
          }
        }},
      ]);
  };

  const groupedCountries = useMemo(() => {
    if (!matrix?.countries) return [];
    const q = countrySearch.trim().toLowerCase();
    const filtered = q
      ? matrix.countries.filter((c: any) =>
          c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : matrix.countries;
    const groups: Record<string, any[]> = {};
    filtered.forEach((c: any) => {
      const r = c.region || 'other';
      if (!groups[r]) groups[r] = [];
      groups[r].push(c);
    });
    return Object.keys(groups).map((r) => ({ region: r, countries: groups[r] }));
  }, [matrix, countrySearch]);

  const overridesByCountry = useMemo(() => {
    const m: Record<string, number> = {};
    (matrix?.overrides || []).forEach((row: any) => {
      m[row.country_code] = (m[row.country_code] || 0) + 1;
    });
    return m;
  }, [matrix]);

  if (!isAdmin) {
    return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Remote Config</Text>
        <Text style={s.sub}>Global + per-country feature flags</Text>

        <View style={s.tabBar}>
          {(['flags','models','countries'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'flags' ? 'Flags' : t === 'models' ? 'Models' : '🌍 Countries'}
              </Text>
            </Pressable>
          ))}
        </View>

        {busy && tab !== 'countries' ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'flags' ? (
          <>
            <Text style={s.label}>GLOBAL DEFAULTS</Text>
            {FLAG_KEYS.map((k) => (
              <View key={k} style={s.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 16 }}>{FLAG_ICONS[k] || '⚙️'}</Text>
                  <Text style={s.rowLabel}>{k.toUpperCase()}</Text>
                </View>
                <Switch value={!!flags[k]} onValueChange={(v) => toggle(k, v)}
                  disabled={saveBusy}
                  trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
                  thumbColor={flags[k] ? palette.neon : palette.textDim} />
              </View>
            ))}
          </>
        ) : null}

        {tab === 'models' ? (
          <>
            <Text style={s.label}>CURRENT ROUTING</Text>
            {Object.entries(models).length === 0 ? <Text style={s.empty}>No entries.</Text> :
              Object.entries(models).map(([crop, model]) => (
                <View key={crop} style={s.card}>
                  <Text style={s.cardTitle}>{crop}</Text>
                  <Text style={s.meta}>→ {model}</Text>
                  <TextInput style={[s.input, { marginTop: 8 }]}
                    defaultValue={model as string} placeholder="model_key"
                    placeholderTextColor={palette.textDim}
                    onSubmitEditing={(e) => setModel(crop, e.nativeEvent.text)} />
                </View>
              ))}
            <Text style={s.label}>ADD / REPLACE</Text>
            <TextInput style={s.input} placeholder="crop (e.g. rice)"
              placeholderTextColor={palette.textDim} value={newCrop} onChangeText={setNewCrop} />
            <TextInput style={[s.input, { marginTop: 8 }]} placeholder="model_key"
              placeholderTextColor={palette.textDim} value={newModel} onChangeText={setNewModel} />
            <Pressable disabled={saveBusy} onPress={() => setModel(newCrop, newModel)} style={s.btn}>
              <Text style={s.btnText}>SAVE MAPPING</Text>
            </Pressable>
          </>
        ) : null}

        {tab === 'countries' ? (
          <>
            <TextInput style={[s.input, { marginBottom: 12 }]}
              placeholder="Search country or code…"
              placeholderTextColor={palette.textDim}
              value={countrySearch} onChangeText={setCountrySearch}
              autoCapitalize="none" />
            {matrixBusy ? <ActivityIndicator color={palette.neon} /> : null}
            {!matrix ? <Text style={s.empty}>Loading…</Text> : null}

            {groupedCountries.map((g) => (
              <View key={g.region}>
                <Text style={s.regionLabel}>
                  {REGION_LABELS[g.region] || g.region.toUpperCase()} ({g.countries.length})
                </Text>
                {g.countries.map((c: any) => {
                  const overrideCount = overridesByCountry[c.code] || 0;
                  const flag = String.fromCodePoint(
                    0x1F1E6 + c.code.charCodeAt(0) - 65,
                    0x1F1E6 + c.code.charCodeAt(1) - 65);
                  return (
                    <Pressable key={c.code} onPress={() => openCountry(c)}
                      style={({ pressed }) => [s.countryRow, pressed && { opacity: 0.6 }]}>
                      <Text style={{ fontSize: 22 }}>{flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.countryName}>{c.name}</Text>
                        <Text style={s.countryMeta}>{c.currency} · {c.payment_provider}</Text>
                      </View>
                      {overrideCount > 0 ? (
                        <View style={s.overrideBadge}>
                          <Text style={s.overrideBadgeText}>
                            {overrideCount} override{overrideCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      ) : <Text style={s.defaultBadge}>Default</Text>}
                      <Text style={s.chevron}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 60 }} />
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!selectedCountry} animationType="slide" transparent
        onRequestClose={() => setSelectedCountry(null)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Pressable onPress={() => setSelectedCountry(null)}>
                <Text style={s.back}>CLOSE</Text>
              </Pressable>
              {selectedCountry ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 34 }}>
                      {String.fromCodePoint(
                        0x1F1E6 + selectedCountry.code.charCodeAt(0) - 65,
                        0x1F1E6 + selectedCountry.code.charCodeAt(1) - 65)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>{selectedCountry.name}</Text>
                      <Text style={s.sub}>{selectedCountry.code} · {selectedCountry.currency}</Text>
                    </View>
                  </View>
                  {Object.keys(countryFlags).length > 0 ? (
                    <Pressable onPress={resetCountry}
                      style={[s.btn, { backgroundColor: palette.danger, marginTop: 16 }]}>
                      <Text style={[s.btnText, { color: '#fff' }]}>
                        RESET ALL {Object.keys(countryFlags).length} OVERRIDES
                      </Text>
                    </Pressable>
                  ) : null}
                  <Text style={s.label}>FEATURES</Text>
                  {FLAG_KEYS.map((k) => {
                    const globalVal = matrix?.global_flags?.[k] ?? true;
                    const hasOverride = k in countryFlags;
                    const effective = hasOverride ? countryFlags[k] : globalVal;
                    return (
                      <View key={k} style={s.row}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={{ fontSize: 16 }}>{FLAG_ICONS[k] || '⚙️'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.rowLabel}>{k.toUpperCase()}</Text>
                            <Text style={[s.rowBadge,
                              { color: hasOverride ? palette.neon : palette.textDim }]}>
                              {hasOverride ? 'OVERRIDE' : 'GLOBAL'}
                            </Text>
                          </View>
                        </View>
                        <Switch value={effective} onValueChange={() => toggleCountryFlag(k)}
                          disabled={saveBusy}
                          trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
                          thumbColor={effective ? palette.neon : palette.textDim} />
                      </View>
                    );
                  })}
                  <View style={{ height: 60 }} />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14, backgroundColor: p.surface,
    borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  rowLabel: { fontSize: 12, fontWeight: '800', color: p.text, letterSpacing: 1 },
  rowBadge: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13 },
  btn: { marginTop: 14, paddingVertical: 14, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center' },
  btnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, paddingVertical: 20 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  regionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 8 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  countryName: { fontSize: 13, fontWeight: '800', color: p.text },
  countryMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  overrideBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,255,136,0.15)' },
  overrideBadgeText: { fontSize: 9, fontWeight: '800', color: p.neon },
  defaultBadge: { fontSize: 9, color: p.textDim, paddingHorizontal: 8 },
  chevron: { fontSize: 20, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
});
