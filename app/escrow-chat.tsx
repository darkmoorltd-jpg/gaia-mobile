import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, spacing } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { tap as hapticTap } from '../src/utils/haptics';

interface Msg { id: string; order_id: number; sender_id: string; message: string; created_at: string; }

export default function EscrowChat() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const { order_id, other_name } = useLocalSearchParams<{ order_id: string; other_name?: string }>();
  const numId = Number(order_id);

  const [order, setOrder] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!numId) return;
    setBusy(true);
    const { data: o } = await supabase.from('marketplace_orders').select('*').eq('id', numId).maybeSingle();
    setOrder(o);
    const { data: m } = await supabase.from('escrow_messages').select('*').eq('order_id', numId).order('created_at');
    setMsgs(m || []);
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
  }, [numId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!numId) return;
    const ch = supabase
      .channel('escrow_' + numId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escrow_messages', filter: 'order_id=eq.' + numId }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [numId]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user || !numId) return;
    setText('');
    setSending(true);
    try {
      await supabase.from('escrow_messages').insert({ order_id: numId, sender_id: user.id, message: body });
      hapticTap();
    } catch {}
    finally { setSending(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconText}>{'<'}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{other_name || 'Order chat'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {order ? 'Order ' + (order.order_ref || String(order.id).slice(0, 8)) + ' · NGN ' + Math.round(order.total || 0).toLocaleString() : 'Loading...'}
          </Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>
      ) : msgs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Start the conversation</Text>
          <Text style={styles.emptySub}>All messages here are logged for your protection and can be used in disputes.</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: palette.obsidian }]}>{m.message}</Text>
                  <Text style={[styles.time, mine && { color: 'rgba(0,0,0,0.55)' }]}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message..."
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}>
          {sending ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.sendTxt}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: p.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  iconText: { fontSize: 22, color: p.neon, fontWeight: '900' },
  title: { fontSize: 16, fontWeight: '800', color: p.text },
  sub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: p.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  list: { padding: spacing.lg, paddingBottom: 20 },
  row: { marginBottom: 10, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: p.neon, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: p.text },
  time: { fontSize: 10, color: p.textDim, marginTop: 4, textAlign: 'right' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: p.border },
  input: { flex: 1, minHeight: 40, maxHeight: 140, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: p.neon, minWidth: 60, alignItems: 'center' },
  sendTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
