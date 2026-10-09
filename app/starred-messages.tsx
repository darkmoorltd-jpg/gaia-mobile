import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function StarredMessages() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user || !uid) return;
    setBusy(true);
    try {
      const { data: rid } = await supabase.rpc('get_or_create_dm', { other_user_id: uid });
      const roomId = rid as unknown as string;
      if (!roomId) { setRows([]); setBusy(false); return; }
      const { data: stars } = await supabase
        .from('chat_stars')
        .select('message_id')
        .eq('user_id', user.id)
        .eq('room_id', roomId);
      const ids = (stars || []).map((s: any) => s.message_id);
      if (ids.length === 0) { setRows([]); setBusy(false); return; }
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id,body,created_at,sender_id,attachment_url,attachment_type')
        .in('id', ids.map((i: string) => Number(i)))
        .order('created_at', { ascending: false });
      setRows(msgs || []);
    } catch (e) { console.log(e); }
    setBusy(false);
  }, [user, uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unstar = (id: number | string) => {
    Alert.alert('Unstar message?', 'Remove from starred?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unstar', style: 'destructive', onPress: async () => {
        if (!user) return;
        try {
          await supabase.from('chat_stars').delete().eq('user_id', user.id).eq('message_id', String(id));
          setRows((prev) => prev.filter((r) => String(r.id) !== String(id)));
        } catch (e) { Alert.alert('Failed'); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Starred messages</Text>
        <Text style={styles.sub}>{rows.length} starred</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {!busy && rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>No starred messages yet.</Text>
            <Text style={styles.emptySub}>Long-press any message → Star to save it here.</Text>
          </View>
        ) : null}

        {rows.map((r) => (
          <Pressable key={String(r.id)} onLongPress={() => unstar(r.id)} delayLongPress={350} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.star}>★</Text>
              <Text style={styles.time}>{new Date(r.created_at).toLocaleString()}</Text>
            </View>
            {r.attachment_type === 'image' && r.attachment_url ? (
              <Image source={{ uri: r.attachment_url }} style={styles.img} />
            ) : null}
            {r.attachment_type === 'file' ? <Text style={styles.body}>[File] {r.body}</Text> : null}
            {!r.attachment_type && r.body ? <Text style={styles.body}>{r.body}</Text> : null}
          </Pressable>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#8696a0', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: '#8696a0', marginTop: 4, marginBottom: 16 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { fontSize: 14, fontWeight: '700', color: '#8696a0' },
  emptySub: { fontSize: 11, color: '#5a6a72', marginTop: 6, textAlign: 'center' },
  card: { padding: 14, backgroundColor: '#202c33', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2a3942' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  star: { fontSize: 14, color: '#ffd700' },
  time: { fontSize: 10, color: '#8696a0' },
  body: { fontSize: 14, color: '#e9edef', lineHeight: 20 },
  img: { width: '100%', height: 180, borderRadius: 8, marginTop: 4, backgroundColor: '#0b141a' },
});
