import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
type Tab = 'open' | 'seller_responded' | 'escalated' | 'resolved';

export default function AdminDisputes() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = createStyles(palette);

  const [tab, setTab] = useState<Tab>('open');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [evidence, setEvidence] = useState<{ label: string; url: string }[]>([]);
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.from('marketplace_disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setRows(data || []);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (tab === 'resolved') return rows.filter(r => r.status === 'resolved');
    if (tab === 'escalated') return rows.filter(r => r.status === 'auto_escalated' || r.auto_escalated);
    if (tab === 'seller_responded') return rows.filter(r => r.status === 'seller_responded');
    return rows.filter(r => r.status === 'open');
  }, [rows, tab]);

  const openDetail = async (d: any) => {
    setSelected(d);
    setEvidence([]);
    setNotes('');
    const all: { label: string; url: string }[] = [];
    const buyerPaths = Array.isArray(d.evidence_paths) ? d.evidence_paths : [];
    const sellerPaths = Array.isArray(d.seller_evidence_paths) ? d.seller_evidence_paths : [];
    for (const p of buyerPaths) {
      const { data } = await supabase.storage.from('dispute-evidence').createSignedUrl(p, 60 * 60 * 24);
      if (data?.signedUrl) all.push({ label: `Buyer: ${p.split('/').pop()}`, url: data.signedUrl });
    }
    for (const p of sellerPaths) {
      const { data } = await supabase.storage.from('dispute-evidence').createSignedUrl(p, 60 * 60 * 24);
      if (data?.signedUrl) all.push({ label: `Seller: ${p.split('/').pop()}`, url: data.signedUrl });
    }
    setEvidence(all);
  };

  const resolve = async (resolution: 'refund_buyer' | 'award_seller' | 'split') => {
    if (!selected) return;
    const labels = {
      refund_buyer: 'Refund buyer 100%',
      award_seller: 'Award seller 100%',
      split: 'Split 50/50',
    };
    Alert.alert('Confirm resolution', `${labels[resolution]}?\n\nThis moves money and cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setResolving(true);
        try {
          const { data, error } = await supabase.rpc('resolve_marketplace_dispute', {
            p_dispute_id: selected.id,
            p_resolution: resolution,
            p_notes: notes.trim() || null,
          });
          if (error) throw error;
          if (!data?.ok) throw new Error('Resolution failed');
          Alert.alert('Resolved',
            `To buyer: ₦${Number(data.to_buyer).toLocaleString()}\nTo seller: ₦${Number(data.to_seller).toLocaleString()}`);
          setSelected(null);
          await load();
        } catch (e: any) { Alert.alert('Failed', e.message); }
        finally { setResolving(false); }
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;

  const openCount = rows.filter(r => r.status === 'open').length;
  const respondedCount = rows.filter(r => r.status === 'seller_responded').length;
  const escalatedCount = rows.filter(r => r.status === 'auto_escalated' || r.auto_escalated).length;
  const resolvedCount = rows.filter(r => r.status === 'resolved').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Disputes</Text>
        <Text style={styles.sub}>{openCount + respondedCount + escalatedCount} active · {resolvedCount} resolved</Text>
      </View>

      <View style={styles.tabRow}>
        {([
          { id: 'open', label: `OPEN (${openCount})` },
          { id: 'seller_responded', label: `RESPONDED (${respondedCount})` },
          { id: 'escalated', label: `ESCALATED (${escalatedCount})` },
          { id: 'resolved', label: `RESOLVED (${resolvedCount})` },
        ] as { id: Tab; label: string }[]).map(t => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, tab === t.id && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === t.id && { color: '#000' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && filtered.length === 0 ? <Text style={styles.empty}>No disputes in this tab.</Text> : null}

        {filtered.map(d => {
          const statusColor =
            d.status === 'resolved' ? palette.neon :
            d.status === 'auto_escalated' ? '#ff3b5c' :
            d.status === 'seller_responded' ? '#3b82f6' : '#ffb300';
          const age = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 3600000);
          return (
            <Pressable key={d.id} onPress={() => openDetail(d)} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardCode}>{d.dispute_code}</Text>
                <View style={[styles.badge, { borderColor: statusColor }]}>
                  <Text style={[styles.badgeTxt, { color: statusColor }]}>{String(d.status).replace('_',' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {d.kind.toUpperCase()} · {d.order_ref} · ₦{Number(d.claimed_amount).toLocaleString()}
              </Text>
              <Text style={styles.cardReason}>{d.reason}</Text>
              <Text style={styles.cardTime}>{age}h ago</Text>
              {d.auto_escalated ? <Text style={styles.escalated}>⚠ Auto-escalated (no seller response)</Text> : null}
            </Pressable>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>{selected?.dispute_code}</Text>
            <Text style={styles.cardMeta}>{selected?.kind?.toUpperCase()} · {selected?.order_ref}</Text>

            <Text style={styles.sectionLbl}>CLAIM</Text>
            <View style={styles.block}>
              <KV k="Reason" v={selected?.reason || '—'} />
              <KV k="Claimed" v={`₦${Number(selected?.claimed_amount || 0).toLocaleString()}`} />
              <KV k="Status" v={String(selected?.status || '').toUpperCase()} />
              <KV k="Filed" v={selected ? new Date(selected.created_at).toLocaleString() : '—'} />
            </View>

            <Text style={styles.sectionLbl}>BUYER DESCRIPTION</Text>
            <View style={styles.block}>
              <Text style={styles.body}>{selected?.description || '—'}</Text>
            </View>

            {evidence.length > 0 ? (
              <>
                <Text style={styles.sectionLbl}>EVIDENCE ({evidence.length})</Text>
                {evidence.map((e, i) => (
                  <Pressable key={i} onPress={() => Linking.openURL(e.url)} style={styles.docRow}>
                    <Text style={styles.docLabel}>📎 {e.label}</Text>
                    <Text style={styles.docOpen}>OPEN →</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            {selected?.seller_response ? (
              <>
                <Text style={styles.sectionLbl}>SELLER RESPONSE</Text>
                <View style={styles.block}>
                  <Text style={styles.body}>{selected.seller_response}</Text>
                  <Text style={styles.hint}>Proposal: {String(selected.seller_proposal || '—').replace('_', ' ')}</Text>
                  <Text style={styles.hint}>Responded {selected.seller_responded_at ? new Date(selected.seller_responded_at).toLocaleString() : '—'}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.warnHint}>⏳ Seller has not yet responded</Text>
            )}

            {selected?.status !== 'resolved' ? (
              <>
                <Text style={styles.sectionLbl}>RESOLUTION NOTES</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Optional notes for both parties…"
                  placeholderTextColor={palette.textDim}
                  style={styles.notesInput}
                />

                <Text style={styles.sectionLbl}>DECISION</Text>
                <Pressable onPress={() => resolve('refund_buyer')} disabled={resolving} style={[styles.resolveBtn, { borderColor: '#ff3b5c' }]}>
                  <Text style={[styles.resolveTxt, { color: '#ff3b5c' }]}>REFUND BUYER (100%)</Text>
                </Pressable>
                <Pressable onPress={() => resolve('split')} disabled={resolving} style={[styles.resolveBtn, { borderColor: '#ffb300', marginTop: 8 }]}>
                  <Text style={[styles.resolveTxt, { color: '#ffb300' }]}>SPLIT 50/50</Text>
                </Pressable>
                <Pressable onPress={() => resolve('award_seller')} disabled={resolving} style={[styles.resolveBtn, { borderColor: palette.neon, marginTop: 8 }]}>
                  <Text style={[styles.resolveTxt, { color: palette.neon }]}>AWARD SELLER (minus commission)</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.resolvedBox}>
                <Text style={styles.resolvedTitle}>✅ Resolved: {String(selected?.resolution || '').replace('_',' ')}</Text>
                <Text style={styles.hint}>{selected?.resolution_notes || 'No notes'}</Text>
                <Text style={styles.hint}>By admin {selected?.resolved_at ? new Date(selected.resolved_at).toLocaleString() : ''}</Text>
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, color: '#888', width: 100 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff' }}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedTxt: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 4, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  cardCode: { fontSize: 14, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  cardReason: { fontSize: 13, color: p.text, marginTop: 6 },
  cardTime: { fontSize: 10, color: p.textDim, marginTop: 6 },
  escalated: { fontSize: 11, color: '#ff3b5c', fontWeight: '800', marginTop: 6 },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalSheet: { backgroundColor: p.obsidian, padding: 20, paddingTop: 60, flex: 1 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 8 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  body: { fontSize: 13, color: p.text, lineHeight: 19 },
  hint: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  warnHint: { fontSize: 12, color: '#ffb300', marginTop: 12, fontWeight: '700' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  docLabel: { fontSize: 13, color: p.text },
  docOpen: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  notesInput: { padding: 12, borderRadius: 10, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: 8 },
  resolveBtn: { borderWidth: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  resolveTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  resolvedBox: { marginTop: 20, padding: 14, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12, borderWidth: 1, borderColor: p.neon },
  resolvedTitle: { fontSize: 14, fontWeight: '900', color: p.neon, marginBottom: 6 },
});
