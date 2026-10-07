import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const SUPABASE_URL = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co';

const TAG_RULES: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(plant|sow|sowed|planted|sowing)\b/i, tag: 'planted' },
  { pattern: /\b(spray|sprayed|spraying|fungicide|pesticide|herbicide)\b/i, tag: 'sprayed' },
  { pattern: /\b(fertil|urea|npk|top.?dress|manure)\b/i, tag: 'fertilized' },
  { pattern: /\b(weed|weeded|weeding|hoe|hoeing)\b/i, tag: 'weeding' },
  { pattern: /\b(harvest|harvested|harvesting|reap)\b/i, tag: 'harvest' },
  { pattern: /\b(water|irrigat|rain|drought)\b/i, tag: 'water' },
  { pattern: /\b(pest|worm|armyworm|borer|aphid|caterpillar)\b/i, tag: 'pest' },
  { pattern: /\b(disease|blight|rust|spot|mold|mould|rot|wilt)\b/i, tag: 'disease' },
  { pattern: /\b(sold|sell|sale|market|buyer)\b/i, tag: 'sold' },
  { pattern: /\b(seed|seedling|nursery|transplant)\b/i, tag: 'seed' },
  { pattern: /\b(prune|trim|thin|thinning)\b/i, tag: 'pruned' },
];

function autoTag(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const r of TAG_RULES) if (r.pattern.test(text)) out.add(r.tag);
  return Array.from(out);
}

async function compressPhoto(uri: string): Promise<string> {
  // ImagePicker can't resize on its own; use quality via picker options + FileSystem to re-encode if huge.
  // Simplest reliable approach: quality 0.5 + ask picker to limit resolution.
  return uri;
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function Journal() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);

  const [entries, setEntries] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [t, f, s] = await Promise.all([
        supabase.rpc('journal_timeline', { p_limit: 200 }),
        supabase.from('farms').select('id,name,crop').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.rpc('journal_season_summary', { p_days: 120 }),
      ]);
      setEntries(t.data || []);
      setFarms(f.data || []);
      setSummary(s.data);
    } catch (e) {
      console.log('journal load error', e);
    }
    setBusy(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weatherAt = async (lat: number, lon: number) => {
    try {
      const r = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,relative_humidity_2m,precipitation'
      );
      const j = await r.json();
      if (j.current) {
        return {
          temp_c: j.current.temperature_2m,
          humidity: j.current.relative_humidity_2m,
          rain_mm: j.current.precipitation,
        };
      }
    } catch {}
    return {};
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const g = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (g && g[0]) return (g[0].city || g[0].subregion || g[0].region || '').trim();
    } catch {}
    return '';
  };

  const uploadPhoto = async (uri: string): Promise<{ url: string; thumbUrl: string } | null> => {
    if (!user) return null;
    try {
      const path = user.id + '/' + Date.now() + '.jpg';
      const up = await FileSystem.uploadAsync(
        SUPABASE_URL + '/storage/v1/object/field-journal/' + path,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'false',
          },
        },
      );
      if (up.status < 200 || up.status >= 300) return null;
      const url = SUPABASE_URL + '/storage/v1/object/public/field-journal/' + path;
      return { url, thumbUrl: url };
    } catch {
      return null;
    }
  };

  const capturePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Camera permission required'); return; }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
      if (res.canceled || !user) return;

      const uri = res.assets[0].uri;
      setSaving(true);

      let loc: Location.LocationObject | null = null;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {}

      const [upload, w, place] = await Promise.all([
        uploadPhoto(uri),
        loc ? weatherAt(loc.coords.latitude, loc.coords.longitude) : Promise.resolve({}),
        loc ? reverseGeocode(loc.coords.latitude, loc.coords.longitude) : Promise.resolve(''),
      ]);

      if (!upload) {
        Alert.alert('Upload failed', 'Could not save photo. Check connection.');
        setSaving(false);
        return;
      }

      const note = noteText.trim();
      const tags = autoTag(note);

      await supabase.from('field_journal').insert({
        user_id: user.id,
        farm_id: farmId,
        kind: 'photo',
        source: 'manual',
        note,
        image_url: upload.url,
        thumb_url: upload.thumbUrl,
        lat: loc ? loc.coords.latitude : null,
        lon: loc ? loc.coords.longitude : null,
        location_name: place,
        weather: w,
        tags,
      });

      setNoteText('');
      setSaving(false);
      setShowNew(false);
      load();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Error', e?.message || 'Could not save entry');
    }
  };

  const startVoice = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone permission required'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Recording error', e?.message || 'Try again');
    }
  };

  const stopVoice = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setRecording(false);
      if (!uri || !user) return;
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setSaving(false); return; }

      const up = await FileSystem.uploadAsync(
        'https://gaia-api-xuly.onrender.com/stt',
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'audio',
          mimeType: 'audio/m4a',
          headers: { Authorization: 'Bearer ' + token },
        },
      );
      if (up.status < 200 || up.status >= 300) {
        Alert.alert('Transcription failed');
        setSaving(false);
        return;
      }
      const data = JSON.parse(up.body || '{}');
      const text = (data.text || '').trim();
      if (!text) { Alert.alert('No speech detected'); setSaving(false); return; }

      const tags = autoTag(text);
      let loc: Location.LocationObject | null = null;
      try { loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); } catch {}
      const w = loc ? await weatherAt(loc.coords.latitude, loc.coords.longitude) : {};
      const place = loc ? await reverseGeocode(loc.coords.latitude, loc.coords.longitude) : '';

      await supabase.from('field_journal').insert({
        user_id: user.id,
        farm_id: farmId,
        kind: 'voice',
        source: 'manual',
        note: text,
        transcript: text,
        lat: loc ? loc.coords.latitude : null,
        lon: loc ? loc.coords.longitude : null,
        location_name: place,
        weather: w,
        tags,
      });

      setSaving(false);
      setShowNew(false);
      load();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Voice error', e?.message || 'Try again');
    }
  };

  const saveNote = async () => {
    if (!noteText.trim() || !user) return;
    setSaving(true);
    try {
      const text = noteText.trim();
      const tags = autoTag(text);
      let loc: Location.LocationObject | null = null;
      try { loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); } catch {}
      const w = loc ? await weatherAt(loc.coords.latitude, loc.coords.longitude) : {};
      const place = loc ? await reverseGeocode(loc.coords.latitude, loc.coords.longitude) : '';

      await supabase.from('field_journal').insert({
        user_id: user.id,
        farm_id: farmId,
        kind: 'note',
        source: 'manual',
        note: text,
        lat: loc ? loc.coords.latitude : null,
        lon: loc ? loc.coords.longitude : null,
        location_name: place,
        weather: w,
        tags,
      });

      setNoteText('');
      setSaving(false);
      setShowNew(false);
      load();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Save failed', e?.message || 'Try again');
    }
  };

  const deleteEntry = (e: any) => {
    if (e.source === 'scan') {
      Alert.alert('Auto-generated', 'Scan entries are managed from the Crops/Pests pages.');
      return;
    }
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('field_journal').delete().eq('id', e.id);
        setEntries((prev) => prev.filter((x) => x.id !== e.id || x.source !== 'journal'));
        load();
      }},
    ]);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const tags = autoTag(editing.text);
    await supabase.from('field_journal')
      .update({ note: editing.text, tags, updated_at: new Date().toISOString() })
      .eq('id', editing.id);
    setEditing(null);
    setSaving(false);
    load();
  };

  const filtered = search.trim()
    ? entries.filter((e) => {
        const hay = ((e.note || '') + ' ' + (e.transcript || '') + ' ' + ((e.tags || []) as string[]).join(' ')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : entries;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Pill label="Field Log" />
        <Text style={styles.title}>Farm Journal</Text>
        <Text style={styles.sub}>
          {summary ? summary.entries + ' entries · ' + summary.photos + ' photos · last ' + summary.notes + ' notes' : 'Tap an action to add an entry'}
        </Text>

        <View style={styles.actionRow}>
          <Pressable onPress={() => { setShowNew(true); setFarmId(farms[0]?.id || null); }} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>A</Text>
            <Text style={styles.actionLbl}>NEW ENTRY</Text>
          </Pressable>
          <Pressable onPress={capturePhoto} style={[styles.actionBtn, { borderColor: '#4fc3f7' }]}>
            <Text style={[styles.actionIcon, { color: '#4fc3f7' }]}>P</Text>
            <Text style={styles.actionLbl}>PHOTO</Text>
          </Pressable>
          <Pressable onPress={recording ? stopVoice : startVoice} style={[styles.actionBtn, recording && { borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.1)' }]}>
            <Text style={[styles.actionIcon, recording && { color: '#ff3b5c' }]}>{recording ? 'S' : 'V'}</Text>
            <Text style={styles.actionLbl}>{recording ? 'STOP' : 'VOICE'}</Text>
          </Pressable>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes, tags, transcripts..."
          placeholderTextColor={palette.textDim}
          style={styles.search}
          autoCapitalize="none"
        />

        {summary && (summary.by_tag || []).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
            {(summary.by_tag || []).map((t: any) => (
              <Pressable key={t.tag} onPress={() => setSearch(t.tag)} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{t.tag} · {t.n}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {busy && entries.length === 0 ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No entries yet'}</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different search.' : 'Capture a photo, speak a note, or write something. GAIA will tag it for you.'}
            </Text>
          </View>
        ) : filtered.map((e) => (
          <Pressable
            key={e.source + '-' + e.id}
            onLongPress={() => {
              if (e.source === 'journal') {
                Alert.alert('Entry options', '', [
                  { text: 'Edit note', onPress: () => setEditing({ id: e.id, text: e.note || '' }) },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(e) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                deleteEntry(e);
              }
            }}
            delayLongPress={400}
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <View style={styles.kindPill}>
                <Text style={styles.kindPillText}>
                  {e.source === 'scan' ? 'SCAN' : String(e.kind).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.cardTime}>{fmtTime(e.created_at)}</Text>
            </View>

            {e.image_url ? (
              <Image source={{ uri: e.image_url }} style={styles.photo} resizeMode="cover" />
            ) : null}

            {e.note ? (
              <Text style={styles.note}>{e.note}</Text>
            ) : null}

            {e.transcript && e.transcript !== e.note ? (
              <Text style={styles.transcript}>Voice: {e.transcript}</Text>
            ) : null}

            {(e.tags || []).length > 0 ? (
              <View style={styles.tagRow}>
                {(e.tags || []).map((t: string) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {(e.location_name || e.weather?.temp_c != null) ? (
              <Text style={styles.meta}>
                {e.location_name ? e.location_name : ''}
                {e.weather?.temp_c != null ? (e.location_name ? ' · ' : '') + e.weather.temp_c + 'C, ' + (e.weather.humidity || 0) + '% hum' : ''}
              </Text>
            ) : null}
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Entry</Text>

            {farms.length > 0 ? (
              <>
                <Text style={styles.label}>FARM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmRow}>
                  <Pressable onPress={() => setFarmId(null)} style={[styles.farmChip, farmId === null && styles.farmChipOn]}>
                    <Text style={[styles.farmChipText, farmId === null && styles.farmChipTextOn]}>None</Text>
                  </Pressable>
                  {farms.map((f) => (
                    <Pressable key={f.id} onPress={() => setFarmId(f.id)} style={[styles.farmChip, farmId === f.id && styles.farmChipOn]}>
                      <Text style={[styles.farmChipText, farmId === f.id && styles.farmChipTextOn]}>{f.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>NOTE</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What did you do or see today?"
              placeholderTextColor={palette.textDim}
              multiline
              style={styles.textArea}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowNew(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnTextGhost}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveNote} disabled={saving || !noteText.trim()} style={[styles.modalBtn, (saving || !noteText.trim()) && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.modalBtnText}>Save</Text>}
              </Pressable>
            </View>

            <Pressable onPress={capturePhoto} style={styles.altBtn}>
              <Text style={styles.altBtnText}>Or attach a photo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Entry</Text>
            <TextInput
              value={editing?.text || ''}
              onChangeText={(v) => editing && setEditing({ ...editing, text: v })}
              multiline
              style={styles.textArea}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(null)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnTextGhost}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} disabled={saving} style={styles.modalBtn}>
                {saving ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.modalBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  actionIcon: { fontSize: 18, fontWeight: '900', color: p.neon },
  actionLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4 },
  search: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 12 },
  tagScroll: { gap: 6, paddingRight: 16, marginBottom: 12 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)' },
  tagChipText: { fontSize: 10, fontWeight: '800', color: '#00ff88' },
  empty: { padding: 30, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: p.text, marginBottom: 6 },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kindPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,255,136,0.12)' },
  kindPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#00ff88' },
  cardTime: { fontSize: 10, color: p.textMuted },
  photo: { width: '100%', height: 180, borderRadius: 12, marginBottom: 8 },
  note: { fontSize: 13, color: p.text, lineHeight: 19 },
  transcript: { fontSize: 11, color: p.textMuted, marginTop: 6, fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,255,136,0.1)' },
  tagText: { fontSize: 9, fontWeight: '800', color: '#00ff88' },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 8, marginBottom: 6 },
  farmRow: { gap: 6, paddingRight: 16, marginBottom: 12 },
  farmChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  farmChipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  farmChipText: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  farmChipTextOn: { color: p.neon },
  textArea: { minHeight: 120, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, textAlignVertical: 'top', fontSize: 14, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.borderHi },
  modalBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBtnTextGhost: { fontSize: 13, fontWeight: '900', color: p.text, letterSpacing: 1 },
  altBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  altBtnText: { fontSize: 12, color: p.neon, fontWeight: '800' },
});
