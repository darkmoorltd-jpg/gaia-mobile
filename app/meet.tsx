import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Share, Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
type Tab = 'requests' | 'live' | 'history';

const TOPICS = ['Crop disease', 'Pest problem', 'Soil issue', 'Loan / finance', 'Verification help', 'Other'];

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function Meet() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<Tab>('requests');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myMeetings, setMyMeetings] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [showNewReq, setShowNewReq] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const tasks: any[] = [
        supabase.rpc('meet_my_requests'),
        supabase.rpc('meet_my_meetings'),
      ];
      if (isAdmin) tasks.push(supabase.rpc('meet_admin_pending'));
      const results = await Promise.all(tasks);
      setMyRequests(results[0].data || []);
      setMyMeetings(results[1].data || []);
      if (isAdmin && results[2]) setPending(results[2].data || []);
    } catch (e) {
      console.log('meet load error', e);
    }
    setBusy(false);
    setRef(false);
  }, [user, isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startInstant = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('meet_create_meeting', {
      p_title: (user.email?.split('@')[0] || 'Farmer') + "'s meeting",
      p_topic: null,
    });
    setBusy(false);
    if (error || !data?.room_id) {
      Alert.alert('Could not start', error?.message || 'Try again');
      return;
    }
    router.push(('/meet-room?room=' + data.room_id) as any);
  };

  const acceptRequest = (req: any) => {
    Alert.alert(
      'Accept consultation request?',
      req.requester_name ? ('From ' + req.requester_name) : ('From ' + req.requester_email),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept + Start',
          onPress: async () => {
            setBusy(true);
            const { data, error } = await supabase.rpc('meet_request_accept', {
              p_request_id: req.id,
              p_scheduled_for: null,
              p_response_note: null,
            });
            setBusy(false);
            if (error) { Alert.alert('Failed', error.message); return; }
            const room = data?.room_id;
            if (room) router.push(('/meet-room?room=' + room) as any);
          },
        },
      ],
    );
  };

  const rejectRequest = (req: any) => {
    Alert.alert('Reject request?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('meet_request_reject', {
          p_request_id: req.id,
          p_reason: null,
        });
        if (error) Alert.alert('Failed', error.message);
        else load();
      }},
    ]);
  };

  const active = myMeetings.filter((m) => m.status === 'active');
  const past = myMeetings.filter((m) => m.status !== 'active');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>GAIA MEET</Text>
        <Text style={styles.title}>Consultations</Text>
        <Text style={styles.sub}>Request an agronomist or start an instant call</Text>

        <View style={styles.actions}>
          <Pressable onPress={() => setShowNewReq(true)} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>REQUEST CONSULTATION</Text>
          </Pressable>
          <Pressable onPress={startInstant} style={styles.ghostAction}>
            <Text style={styles.ghostActionText}>START INSTANT</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setShowJoin(true)} style={styles.ghostFull}>
          <Text style={styles.ghostActionText}>JOIN WITH ROOM ID</Text>
        </Pressable>

        <View style={styles.tabs}>
          {(['requests', 'live', 'history'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'requests' ? 'MY REQUESTS' : t === 'live' ? 'LIVE NOW' : 'HISTORY'}
              </Text>
            </Pressable>
          ))}
        </View>

        {busy && myRequests.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {tab === 'requests' ? (
          <>
            {isAdmin && pending.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>PENDING REQUESTS ({pending.length})</Text>
                {pending.map((r) => (
                  <View key={r.id} style={[styles.card, { borderLeftColor: '#ffb300' }]}>
                    <Text style={styles.cardTitle}>{r.topic}</Text>
                    <Text style={styles.cardMeta}>{r.requester_name || r.requester_email}</Text>
                    {r.note ? <Text style={styles.cardNote}>{r.note}</Text> : null}
                    {r.preferred_time ? <Text style={styles.cardMeta}>Preferred: {r.preferred_time}</Text> : null}
                    {r.phone ? <Text style={styles.cardMeta}>Phone: {r.phone}</Text> : null}
                    <Text style={styles.cardMeta}>{fmtDate(r.created_at)}</Text>
                    <View style={styles.cardActions}>
                      <Pressable onPress={() => acceptRequest(r)} style={[styles.miniBtn, { borderColor: '#00ff88' }]}>
                        <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>ACCEPT + START</Text>
                      </Pressable>
                      <Pressable onPress={() => rejectRequest(r)} style={[styles.miniBtn, { borderColor: '#ff3b5c' }]}>
                        <Text style={[styles.miniBtnText, { color: '#ff3b5c' }]}>REJECT</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            <Text style={styles.sectionLabel}>MY REQUESTS ({myRequests.length})</Text>
            {myRequests.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No requests yet. Tap Request Consultation to ask for help.</Text>
              </View>
            ) : myRequests.map((r) => {
              const statusColor = r.status === 'accepted' ? '#00ff88' : r.status === 'rejected' ? '#ff3b5c' : '#ffb300';
              return (
                <View key={r.id} style={[styles.card, { borderLeftColor: statusColor }]}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{r.topic}</Text>
                    <Text style={[styles.statusChip, { color: statusColor }]}>{String(r.status).toUpperCase()}</Text>
                  </View>
                  {r.note ? <Text style={styles.cardNote}>{r.note}</Text> : null}
                  {r.response_note ? <Text style={styles.cardResponse}>Response: {r.response_note}</Text> : null}
                  <Text style={styles.cardMeta}>{fmtDate(r.created_at)}</Text>
                  {r.status === 'accepted' && r.room_id ? (
                    <View style={styles.cardActions}>
                      <Pressable
                        onPress={() => router.push(('/meet-room?room=' + r.room_id) as any)}
                        style={[styles.miniBtn, { borderColor: '#00ff88' }]}
                      >
                        <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>JOIN CALL</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          await Share.share({ message: 'Join my GAIA consultation: https://meet.jit.si/' + r.room_id });
                        }}
                        style={[styles.miniBtn, { borderColor: palette.neon }]}
                      >
                        <Text style={[styles.miniBtnText, { color: palette.neon }]}>SHARE LINK</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'live' ? (
          <>
            <Text style={styles.sectionLabel}>ACTIVE NOW ({active.length})</Text>
            {active.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>No active calls. Tap Start Instant to launch one.</Text></View>
            ) : active.map((m) => (
              <View key={m.id} style={styles.card}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardMeta}>{m.is_host ? 'You are host' : 'Hosted by ' + (m.host_email || 'someone')}</Text>
                <Text style={styles.cardMeta}>{m.participant_count} participant{m.participant_count === 1 ? '' : 's'} · started {fmtDate(m.created_at)}</Text>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => router.push(('/meet-room?room=' + m.room_id) as any)} style={[styles.miniBtn, { borderColor: '#00ff88' }]}>
                    <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>JOIN</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await Share.share({ message: 'Join my GAIA meeting: https://meet.jit.si/' + m.room_id });
                    }}
                    style={[styles.miniBtn, { borderColor: palette.neon }]}
                  >
                    <Text style={[styles.miniBtnText, { color: palette.neon }]}>SHARE</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'history' ? (
          <>
            <Text style={styles.sectionLabel}>PAST MEETINGS ({past.length})</Text>
            {past.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>No past meetings.</Text></View>
            ) : past.map((m) => (
              <View key={m.id} style={[styles.card, { opacity: 0.75 }]}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardMeta}>{m.participant_count} participants · ended {fmtDate(m.ended_at || m.created_at)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      <NewRequestModal
        visible={showNewReq}
        onClose={() => setShowNewReq(false)}
        onCreated={() => { setShowNewReq(false); load(); }}
      />

      <JoinModal
        visible={showJoin}
        onClose={() => setShowJoin(false)}
        onJoin={(room) => { setShowJoin(false); router.push(('/meet-room?room=' + room) as any); }}
      />
    </View>
  );
}

function NewRequestModal({ visible, onClose, onCreated }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [note, setNote] = useState('');
  const [preferred, setPreferred] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('user_profiles').select('phone').eq('user_id', user.id).maybeSingle();
      if (data?.phone) setPhone(data.phone);
    })();
  }, [user, visible]);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('meet_request_create', {
      p_topic: topic,
      p_note: note.trim() || null,
      p_preferred_time: preferred.trim() || null,
      p_phone: phone.trim() || null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setNote(''); setPreferred('');
    onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Request Consultation</Text>

          <Text style={styles.label}>TOPIC</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TOPICS.map((t) => (
              <Pressable key={t} onPress={() => setTopic(t)} style={[styles.chip, topic === t && styles.chipOn]}>
                <Text style={[styles.chipText, topic === t && styles.chipTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Describe your problem"
            placeholderTextColor={palette.textDim}
            style={styles.textArea}
            multiline
          />

          <Text style={styles.label}>PREFERRED TIME (OPTIONAL)</Text>
          <TextInput
            value={preferred}
            onChangeText={setPreferred}
            placeholder="e.g. Tomorrow morning"
            placeholderTextColor={palette.textDim}
            style={styles.input}
          />

          <Text style={styles.label}>PHONE (FOR CALLBACK)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="080..."
            placeholderTextColor={palette.textDim}
            style={styles.input}
            keyboardType="phone-pad"
          />

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnTextGhost}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={busy} style={[styles.modalBtn, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.modalBtnText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function JoinModal({ visible, onClose, onJoin }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!room.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('meet_join_meeting', { p_room: room.trim() });
    setBusy(false);
    if (error || !data?.ok) {
      Alert.alert('Join failed', error?.message || data?.error || 'Meeting not found');
      return;
    }
    const r = room.trim();
    setRoom('');
    onJoin(r);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Join with Room ID</Text>
          <Text style={styles.label}>ROOM ID</Text>
          <TextInput
            value={room}
            onChangeText={setRoom}
            placeholder="gaia-xxxxxxxxxxxxxxxx"
            placeholderTextColor={palette.textDim}
            style={styles.input}
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnTextGhost}>Cancel</Text>
            </Pressable>
            <Pressable onPress={join} disabled={busy} style={[styles.modalBtn, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.modalBtnText}>Join</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  primaryAction: { flex: 1.5, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  primaryActionText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: p.obsidian },
  ghostAction: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  ghostActionText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: p.neon },
  ghostFull: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabOn: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  tabText: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 0.8 },
  tabTextOn: { color: p.neon },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: 12, marginBottom: 10 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4, borderLeftColor: p.neon },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  statusChip: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  cardNote: { fontSize: 12, color: p.text, marginTop: 6, lineHeight: 17 },
  cardResponse: { fontSize: 12, color: p.neon, marginTop: 6, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  miniBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  chipRow: { gap: 6, paddingRight: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTextOn: { color: p.neon },
  input: { padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 8 },
  textArea: { minHeight: 90, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, textAlignVertical: 'top', marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.borderHi },
  modalBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBtnTextGhost: { fontSize: 13, fontWeight: '900', color: p.text, letterSpacing: 1 },
});
