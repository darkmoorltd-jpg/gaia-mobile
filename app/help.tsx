import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Linking, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const WHATSAPP = '2347054647903';
const EMAIL = 'darkmoorltd@gmail.com';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  attachment_url: string | null;
  created_at: string;
  replies: { id: string; message: string; is_admin: boolean; created_at: string }[];
}

const FAQS = [
  { q: 'How do scans work?', a: 'Each scan analyses one image for a crop, pest, soil type, or livestock diagnosis. Every scan costs 1 scan from your balance.' },
  { q: 'How do I get more scans?', a: 'Open Wallet → Buy Scans from Wallet, or pay directly from the Buy Scans page with your card. Starter: 150 scans for N3,000.' },
  { q: 'Is my data secure?', a: 'Yes. Your photos are stored in encrypted Supabase buckets. Only you and GAIA admins can view them.' },
  { q: 'How do I verify my account?', a: 'Profile → Verification. Submit your NIN/BVN, ID card, and selfie. Approval usually takes under 24 hours.' },
  { q: 'Can I use GAIA offline?', a: 'Partial. The app caches your last diagnoses and reference data. Full offline map packs are coming soon.' },
  { q: 'How do I become a seller?', a: 'Profile → Verification → complete KYC. Once approved, "Sell" appears in the Marketplace.' },
];

export default function Help() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [tab, setTab] = useState<'new' | 'tickets'>('new');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<{ uri: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ref, setRef] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const { data: rows } = await supabase
        .from('support_tickets')
        .select('id,subject,message,status,attachment_url,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const list = rows || [];
      for (const t of list) {
        const { data: replies } = await supabase
          .from('support_replies')
          .select('id,message,is_admin,created_at')
          .eq('ticket_id', t.id)
          .order('created_at');
        t.replies = replies || [];
      }
      setTickets(list);
    } catch (e) {
      console.log('loadTickets failed', e);
    }
    setLoadingTickets(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadTickets(); }, [loadTickets]));

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const a = res.assets[0];
      setAttachment({ uri: a.uri, name: a.name || 'attachment' });
    } catch (e: any) {
      Alert.alert('File error', e?.message || 'Could not pick file');
    }
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachment || !user) return null;
    try {
      const b64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const path = user.id + '/' + Date.now() + '-' + attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const { error } = await supabase.storage
        .from('support_attachments')
        .upload(path, bytes.buffer, { contentType: 'application/octet-stream', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('support_attachments').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.log('upload failed', e);
      return null;
    }
  };

  const submit = async () => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Required', 'Subject and message are required.');
      return;
    }
    setBusy(true);
    let url: string | null = null;
    if (attachment) url = await uploadAttachment();
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
      attachment_url: url,
      status: 'open',
    });
    setBusy(false);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    setSubject('');
    setMessage('');
    setAttachment(null);
    Alert.alert('Sent', 'The GAIA team will respond within 2 hours.');
    setTab('tickets');
    loadTickets();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); loadTickets(); }} tintColor={palette.neon} />}
      >
        <Pressable
          onPress={() => {
            if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back();
            else router.replace('/(tabs)/profile' as any);
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Text style={styles.backTxt}>{'<'} BACK</Text>
        </Pressable>

        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>We reply in under 2 hours.</Text>

        {/* ---------- CONTACT CHIPS ---------- */}
        <View style={styles.contactRow}>
          <Pressable onPress={() => Linking.openURL('https://wa.me/' + WHATSAPP + '?text=Hello%20GAIA')} style={[styles.contactChip, { borderColor: '#25d366' }]}>
            <Text style={[styles.contactIcon, { color: '#25d366' }]}>W</Text>
            <Text style={styles.contactLbl}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('mailto:' + EMAIL + '?subject=GAIA%20Support')} style={[styles.contactChip, { borderColor: '#4fc3f7' }]}>
            <Text style={[styles.contactIcon, { color: '#4fc3f7' }]}>@</Text>
            <Text style={styles.contactLbl}>Email</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('tel:+' + WHATSAPP)} style={[styles.contactChip, { borderColor: palette.neon }]}>
            <Text style={[styles.contactIcon, { color: palette.neon }]}>#</Text>
            <Text style={styles.contactLbl}>Call</Text>
          </Pressable>
        </View>

        {/* ---------- TABS ---------- */}
        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab('new')} style={[styles.tab, tab === 'new' && styles.tabOn]}>
            <Text style={[styles.tabTxt, tab === 'new' && styles.tabTxtOn]}>NEW TICKET</Text>
          </Pressable>
          <Pressable onPress={() => setTab('tickets')} style={[styles.tab, tab === 'tickets' && styles.tabOn]}>
            <Text style={[styles.tabTxt, tab === 'tickets' && styles.tabTxtOn]}>MY TICKETS ({tickets.length})</Text>
          </Pressable>
        </View>

        {/* ---------- NEW TICKET ---------- */}
        {tab === 'new' ? (
          <>
            <Text style={styles.label}>SUBJECT</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Payment issue, Crop question"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>MESSAGE</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue..."
              placeholderTextColor={palette.textDim}
              style={[styles.input, { minHeight: 120 }]}
              multiline
            />

            <Text style={styles.label}>ATTACHMENT (OPTIONAL)</Text>
            <Pressable onPress={pickFile} style={styles.attachBtn}>
              <Text style={styles.attachTxt}>
                {attachment ? 'FILE: ' + attachment.name : 'PICK IMAGE OR PDF'}
              </Text>
            </Pressable>

            <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>SEND TO SUPPORT</Text>}
            </Pressable>
          </>
        ) : null}

        {/* ---------- MY TICKETS ---------- */}
        {tab === 'tickets' ? (
          loadingTickets ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> :
          tickets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No tickets yet</Text>
              <Text style={styles.emptySub}>Create one and the GAIA team will reply.</Text>
            </View>
          ) : tickets.map((t) => (
            <View key={t.id} style={styles.ticket}>
              <View style={styles.ticketHead}>
                <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                <Text style={[styles.ticketStatus, { color: t.status === 'closed' ? palette.neon : '#ffb300' }]}>
                  {t.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.ticketMeta}>{new Date(t.created_at).toLocaleString()}</Text>
              <Text style={styles.ticketBody}>{t.message}</Text>

              {t.attachment_url ? (
                <Pressable onPress={() => Linking.openURL(t.attachment_url!)}>
                  <Text style={styles.ticketLink}>Open attachment</Text>
                </Pressable>
              ) : null}

              {t.replies && t.replies.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.repliesLabel}>CONVERSATION</Text>
                  {t.replies.map((r) => (
                    <View key={r.id} style={[styles.reply, r.is_admin && styles.replyAdmin]}>
                      <Text style={[styles.replyWho, r.is_admin && { color: palette.neon }]}>
                        {r.is_admin ? 'GAIA TEAM' : 'YOU'}
                      </Text>
                      <Text style={styles.replyBody}>{r.message}</Text>
                      <Text style={styles.replyTime}>{new Date(r.created_at).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        ) : null}

        {/* ---------- FAQ ---------- */}
        <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
        {FAQS.map((f, i) => (
          <Pressable key={i} onPress={() => setOpenFaq(openFaq === i ? null : i)} style={styles.faqCard}>
            <View style={styles.faqHead}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqChevron}>{openFaq === i ? '-' : '+'}</Text>
            </View>
            {openFaq === i ? <Text style={styles.faqA}>{f.a}</Text> : null}
          </Pressable>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },

  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  contactChip: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, alignItems: 'center', gap: 6 },
  contactIcon: { fontSize: 20, fontWeight: '900' },
  contactLbl: { fontSize: 11, fontWeight: '800', color: p.text, letterSpacing: 0.5 },

  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabTxt: { fontSize: 10, fontWeight: '900', color: p.textDim, letterSpacing: 1.5 },
  tabTxtOn: { color: p.neon },

  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  attachBtn: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border, borderStyle: 'dashed', alignItems: 'center' },
  attachTxt: { fontSize: 11, fontWeight: '800', color: p.neon, letterSpacing: 1 },
  cta: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },

  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 12, color: p.textMuted, marginTop: 6, textAlign: 'center' },

  ticket: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 12, borderWidth: 1, borderColor: p.border },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketSubject: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  ticketStatus: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  ticketMeta: { fontSize: 10, color: p.textMuted, marginBottom: 8 },
  ticketBody: { fontSize: 12, color: p.text, lineHeight: 18 },
  ticketLink: { fontSize: 11, fontWeight: '800', color: p.neon, marginTop: 8 },
  repliesLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  reply: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 6, borderLeftWidth: 2, borderLeftColor: p.textDim },
  replyAdmin: { borderLeftColor: p.neon, backgroundColor: 'rgba(0,255,136,0.05)' },
  replyWho: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: p.textMuted },
  replyBody: { fontSize: 12, color: p.text, marginTop: 4, lineHeight: 17 },
  replyTime: { fontSize: 9, color: p.textDim, marginTop: 4 },

  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  faqCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  faqHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontSize: 13, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  faqChevron: { fontSize: 18, fontWeight: '900', color: p.neon, lineHeight: 20 },
  faqA: { fontSize: 12, color: p.textMuted, marginTop: 10, lineHeight: 18 },
});
