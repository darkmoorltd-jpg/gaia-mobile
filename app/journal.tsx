import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

type Tab = 'journal' | 'diary' | 'timeline';

export default function Journal() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [tab, setTab] = useState<Tab>('journal');
  const [entries, setEntries] = useState<any[]>([]);
  const [diaryText, setDiaryText] = useState('');
  const [mood, setMood] = useState('good');

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('field_journal').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setEntries(data || []);
  };

  const addPhotoEntry = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !user) return;
    const uri = res.assets[0].uri;
    const loc = await Location.getCurrentPositionAsync({});
    const fileName = user.id + '/' + Date.now() + '.jpg';
    const blob = await (await fetch(uri)).blob();
    const buf = await blob.arrayBuffer();
    await supabase.storage.from('field-journal').upload(fileName, buf, { contentType: 'image/jpeg' });
    const { data } = supabase.storage.from('field-journal').getPublicUrl(fileName);
    await supabase.from('field_journal').insert({
      user_id: user.id,
      kind: 'photo',
      image_url: data.publicUrl,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      note: '',
    });
    load();
  };

  const saveDiary = async () => {
    if (!diaryText.trim() || !user) return;
    await supabase.from('field_journal').insert({
      user_id: user.id, kind: 'diary', note: diaryText.trim(), mood,
    });
    setDiaryText('');
    load();
  };

  const shareWhatsApp = (e: any) => {
    const text = e.kind === 'photo' ? 'Check out my crop: ' + e.image_url : 'Field note: ' + e.note;
    Linking.openURL('whatsapp://send?text=' + encodeURIComponent(text));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Field Log" />
        <Text style={styles.title}>My Farm Journal</Text>

        <View style={styles.tabs}>
          {(['journal', 'diary', 'timeline'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'journal' ? (
          <>
            <NeonButton label="+ CAPTURE PHOTO" onPress={addPhotoEntry} />
            <Text style={styles.section}>RECENT</Text>
            {entries.filter((e) => e.kind === 'photo').slice(0, 30).map((e) => (
              <GlassCard key={e.id} style={{ marginBottom: 10 }}>
                <Image source={{ uri: e.image_url }} style={styles.photo} />
                <Text style={styles.note}>{e.note || 'No note'}</Text>
                <Text style={styles.meta}>{new Date(e.created_at).toLocaleString()}</Text>
                <Pressable onPress={() => shareWhatsApp(e)} style={styles.shareBtn}>
                  <Text style={styles.shareText}>SHARE ON WHATSAPP</Text>
                </Pressable>
              </GlassCard>
            ))}
          </>
        ) : null}

        {tab === 'diary' ? (
          <>
            <TextInput value={diaryText} onChangeText={setDiaryText} placeholder="What happened today?" placeholderTextColor={palette.textDim} multiline style={styles.textArea} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {['good', 'ok', 'bad'].map((m) => (
                <Pressable key={m} onPress={() => setMood(m)} style={[styles.mood, mood === m && styles.moodActive]}>
                  <Text style={[styles.moodText, mood === m && styles.moodTextActive]}>{m.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <NeonButton label="SAVE NOTE" onPress={saveDiary} style={{ marginTop: 12 }} />

            <Text style={styles.section}>PAST NOTES</Text>
            {entries.filter((e) => e.kind === 'diary').map((e) => (
              <GlassCard key={e.id} style={{ marginBottom: 8 }}>
                <Text style={styles.diaryText}>{e.note}</Text>
                <Text style={styles.meta}>{e.mood} · {new Date(e.created_at).toLocaleDateString()}</Text>
              </GlassCard>
            ))}
          </>
        ) : null}

        {tab === 'timeline' ? (
          <>
            <Text style={styles.section}>ALL ACTIVITY</Text>
            {entries.map((e) => (
              <View key={e.id} style={styles.timelineRow}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineDate}>{new Date(e.created_at).toLocaleDateString()}</Text>
                  <Text style={styles.timelineKind}>{e.kind === 'photo' ? 'Photo' : 'Note'}</Text>
                  <Text style={styles.timelineNote}>{e.note || (e.lat ? 'GPS: ' + e.lat.toFixed(3) + ', ' + e.lon.toFixed(3) : '')}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabText: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  tabTextActive: { color: p.obsidian },
  section: { ...typography.micro, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  note: { color: p.text, marginTop: 10 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  shareBtn: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  shareText: { fontSize: 11, color: p.neon, fontWeight: '700' },
  textArea: { minHeight: 120, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, textAlignVertical: 'top' },
  mood: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  moodActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  moodText: { fontSize: 11, color: p.textMuted, fontWeight: '700' },
  moodTextActive: { color: p.neon },
  diaryText: { color: p.text, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: p.neon, marginTop: 4 },
  timelineDate: { fontSize: 11, color: p.textMuted },
  timelineKind: { fontSize: 14, fontWeight: '800', color: p.text, marginTop: 2 },
  timelineNote: { fontSize: 12, color: p.textMuted, marginTop: 4 },
});
