import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const SEGMENTS = [
  { key: 'all',          label: 'Everyone' },
  { key: 'verified',     label: 'Verified only' },
  { key: 'sellers',      label: 'Sellers' },
  { key: 'inactive_30d', label: 'Inactive 30d' },
];

export default function AdminBroadcast() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('all');
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const send = async () => {
    if (!title.trim() || !body.trim()) { Alert.alert('Title and body required'); return; }
    Alert.alert('Send broadcast?', `Segment: ${segment}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        setBusy(true);
        const { data, error } = await supabase.rpc('admin_broadcast', {
          p_title: title.trim(), p_body: body.trim(), p_segment: segment,
        });
        setBusy(false);
        if (error) Alert.alert('Failed', error.message);
        else { Alert.alert('Queued', `${data} recipients added to push queue.`); setTitle(''); setBody(''); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Broadcast</Text>
        <Text style={styles.sub}>Push a notification to a user segment</Text>

        <Text style={styles.label}>SEGMENT</Text>
        <View style={styles.segmentRow}>
          {SEGMENTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              style={[styles.segBtn, segment === s.key && styles.segBtnActive]}
            >
              <Text style={[styles.segText, segment === s.key && styles.segTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>TITLE</Text>
        <TextInput value={title} onChangeText={setTitle}
          placeholder="e.g. New maize model is live"
          placeholderTextColor={palette.textDim}
          style={styles.input} />

        <Text style={styles.label}>MESSAGE</Text>
        <TextInput value={body} onChangeText={setBody}
          placeholder="Type the notification body…"
          placeholderTextColor={palette.textDim}
          multiline style={[styles.input, { minHeight: 120 }]} />

        <Pressable disabled={busy} onPress={send} style={styles.send}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.sendText}>SEND BROADCAST</Text>}
        </Pressable>

        <Text style={styles.hint}>
          Notifications queue to `notification_queue`. A cron job or edge function must drain it to actually deliver
          push via Expo. Admin audit log records the action.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  segBtnActive: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  segText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  segTextActive: { color: p.neon },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  send: { marginTop: 20, padding: 18, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  sendText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  hint: { marginTop: 16, fontSize: 11, color: p.textMuted, lineHeight: 18, fontStyle: 'italic' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
