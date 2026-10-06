import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const FLAG_KEYS = ['crops','pests','soil','livestock','marketplace','insurance','chat','voice','video','satellite','university','calendar','wallet','badges','loans'];

export default function AdminConfig() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'flags' | 'models'>('flags');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [newCrop, setNewCrop] = useState('');
  const [newModel, setNewModel] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.from('app_settings').select('key,value').in('key', ['feature_flags','model_config']);
    (data || []).forEach((r: any) => {
      if (r.key === 'feature_flags') setFlags(r.value || {});
      if (r.key === 'model_config') setModels(r.value || {});
    });
    setBusy(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, value: boolean) => {
    setSaveBusy(true);
    const { error } = await supabase.rpc('admin_set_flag', { p_key: key, p_value: value });
    setSaveBusy(false);
    if (error) Alert.alert('Failed', error.message);
    else setFlags((f) => ({ ...f, [key]: value }));
  };

  const setModel = async (crop: string, model: string) => {
    if (!crop.trim() || !model.trim()) return;
    setSaveBusy(true);
    const { error } = await supabase.rpc('admin_set_model', { p_crop: crop.trim().toLowerCase(), p_model_key: model.trim() });
    setSaveBusy(false);
    if (error) Alert.alert('Failed', error.message);
    else { setModels((m) => ({ ...m, [crop.toLowerCase()]: model.trim() })); setNewCrop(''); setNewModel(''); }
  };

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Remote Config</Text>
        <Text style={s.sub}>Feature flags + model routing (live for all users)</Text>

        <View style={s.tabBar}>
          <Pressable onPress={() => setTab('flags')} style={[s.tabBtn, tab==='flags' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='flags' && s.tabTextActive]}>Feature Flags</Text>
          </Pressable>
          <Pressable onPress={() => setTab('models')} style={[s.tabBtn, tab==='models' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='models' && s.tabTextActive]}>Model Config</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'flags' ? (
          FLAG_KEYS.map((k) => (
            <View key={k} style={s.row}>
              <Text style={s.rowLabel}>{k.toUpperCase()}</Text>
              <Switch
                value={!!flags[k]}
                onValueChange={(v) => toggle(k, v)}
                disabled={saveBusy}
                trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
                thumbColor={flags[k] ? palette.neon : palette.textDim}
              />
            </View>
          ))
        ) : null}

        {tab === 'models' ? (
          <>
            <Text style={s.label}>CURRENT ROUTING</Text>
            {Object.entries(models).length === 0 ? <Text style={s.empty}>No entries.</Text> :
              Object.entries(models).map(([crop, model]) => (
                <View key={crop} style={s.card}>
                  <Text style={s.cardTitle}>{crop}</Text>
                  <Text style={s.meta}>→ {model}</Text>
                  <TextInput
                    style={[s.input, { marginTop: 8 }]}
                    defaultValue={model as string}
                    placeholder="model_key"
                    placeholderTextColor={palette.textDim}
                    onSubmitEditing={(e) => setModel(crop, e.nativeEvent.text)}
                  />
                </View>
              ))}
            <Text style={s.label}>ADD / REPLACE</Text>
            <TextInput style={s.input} placeholder="crop (e.g. rice)" placeholderTextColor={palette.textDim} value={newCrop} onChangeText={setNewCrop} />
            <TextInput style={[s.input, { marginTop: 8 }]} placeholder="model_key (e.g. rice_6class)" placeholderTextColor={palette.textDim} value={newModel} onChangeText={setNewModel} />
            <Pressable disabled={saveBusy} onPress={() => setModel(newCrop, newModel)} style={s.btn}>
              <Text style={s.btnText}>SAVE MAPPING</Text>
            </Pressable>
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14, backgroundColor: p.surface, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  rowLabel: { fontSize: 12, fontWeight: '800', color: p.text, letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13 },
  btn: { marginTop: 14, paddingVertical: 14, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center' },
  btnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, paddingVertical: 20 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
