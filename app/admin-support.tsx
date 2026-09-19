import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminSupport() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [reply, setReply] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data || []);
    } catch {}
    setBusy(false);
  };

  useEffect(() => { if (user?.email?.toLowerCase() === ADMIN_EMAIL) load(); }, [user]);

  const sendReply = async () => {
    if (!replyTo || !reply.trim()) return;
    await supabase
      .from('support_tickets')
      .update({
        admin_reply: reply.trim(),
        replied_by: user?.id,
        replied_at: new Date().toISOString(),
        status: 'resolved',
      })
      .eq('id', replyTo.id);
    Alert.alert('Reply sent', 'Ticket marked as resolved.');
    setReplyTo(null);
    setReply('');
    load();
  };

  const setStatus = async (id: number, status: string) => {
    await supabase.from('support_tickets').update({ status }).eq('id', id);
    load();
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const open = rows.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
  const resolved = rows.filter((r) => r.status === 'resolved' || r.status === 'closed').length;

  const filtered = filter === 'all'
    ? rows
    : filter === 'open'
      ? rows.filter((r) => r.status === 'open' || r.status === 'in_progress')
      : rows.filter((r) => r.status === 'resolved' || r.status === 'closed');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Support Tickets</Text>

        <View style={styles.tabs}>
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.tab, filter === f && styles.tabActive]}
            >
              <Text style={[styles.tabTxt, filter === f && styles.tabTxtActive]}>
                {f === 'open' ? `Open (${open})` : f === 'resolved' ? `Resolved (${resolved})` : `All (${rows.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {busy ? <Text style={styles.loading}>Loading…</Text> : null}

        {filtered.map((r, i) => {
          const isOpen = r.status === 'open' || r.status === 'in_progress';
          const color = isOpen ? palette.warning : palette.neon;
          return (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.subject} numberOfLines={1}>{r.subject || 'No subject'}</Text>
                <View style={[styles.statusTag, { borderColor: color }]}>
                  <Text style={[styles.statusTxt, { color }]}>{(r.status || 'open').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.message} numberOfLines={3}>{r.message}</Text>
              {r.admin_reply ? (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLbl}>REPLIED</Text>
                  <Text style={styles.replyTxt} numberOfLines={2}>{r.admin_reply}</Text>
                </View>
              ) : null}
              <Text style={styles.date}>{new Date(r.created_at).toLocaleString()}</Text>

              {isOpen ? (
                <View style={styles.row}>
                  <Pressable onPress={() => { setReplyTo(r); setReply(''); }} style={styles.replyBtn}>
                    <Text style={styles.replyBtnTxt}>REPLY</Text>
                  </Pressable>
                  <Pressable onPress={() => setStatus(r.id, 'closed')} style={styles.closeBtn}>
                    <Text style={styles.closeBtnTxt}>CLOSE</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {filtered.length === 0 && !busy ? <Text style={styles.loading}>No tickets.</Text> : null}
      </ScrollView>

      {/* Reply modal */}
      <Modal visible={!!replyTo} transparent animationType="slide" onRequestClosing={() => setReplyTo(null)} onRequestClose={() => setReplyTo(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reply to Ticket</Text>
            <Text style={styles.modalSubject}>{replyTo?.subject}</Text>
            <Text style={styles.modalMsg} numberOfLines={4}>{replyTo?.message}</Text>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Type your reply…"
              placeholderTextColor={palette.textDim}
              multiline
              style={styles.modalInput}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setReplyTo(null)} style={styles.cancel}>
                <Text style={styles.cancelTxt}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={sendReply} disabled={!reply.trim()} style={[styles.confirm, !reply.trim() && { opacity: 0.4 }]}>
                <Text style={styles.confirmTxt}>SEND</Text>
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  tabTxt: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  tabTxtActive: { color: p.neon },
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subject: { flex: 1, fontSize: 15, fontWeight: '800', color: p.text },
  statusTag: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  message: { fontSize: 13, color: p.textMuted, lineHeight: 20 },
  replyBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: p.neonSoft, borderLeftWidth: 3, borderLeftColor: p.neon },
  replyLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: p.neon, marginBottom: 4 },
  replyTxt: { fontSize: 12, color: p.text },
  date: { fontSize: 10, color: p.textDim, marginTop: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  replyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center' },
  replyBtnTxt: { fontWeight: '900', color: p.obsidian, letterSpacing: 1, fontSize: 12 },
  closeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  closeBtnTxt: { fontWeight: '800', color: p.textMuted, letterSpacing: 1, fontSize: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 8 },
  modalSubject: { fontSize: 14, fontWeight: '700', color: p.neon },
  modalMsg: { fontSize: 12, color: p.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  modalInput: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 12, padding: 14, color: p.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  cancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  cancelTxt: { fontWeight: '800', color: p.textMuted },
  confirm: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  confirmTxt: { fontWeight: '900', color: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
