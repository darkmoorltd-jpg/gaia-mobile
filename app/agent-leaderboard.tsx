import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function AgentLeaderboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [agents, setAgents] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await supabase.rpc('admin_agent_leaderboard');
      if (!r.error && r.data) {
        // Sort by verified count descending
        const sorted = [...r.data].sort((a, b) => Number(b.approved) - Number(a.approved));
        setAgents(sorted);
      }
      setBusy(false);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <Text style={styles.sub}>Top agents by verified farmers</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {agents.map((a, i) => {
          const isMe = a.user_id === user?.id;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return (
            <View key={i} style={[styles.card, isMe && styles.cardMe]}>
              <Text style={styles.rank}>{medal}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{a.name || a.email} {isMe ? '(You)' : ''}</Text>
                <Text style={styles.zone}>{a.agent_zone || 'No zone'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.verified}>{a.approved} verified</Text>
                <Text style={styles.reg}>{a.registered} reg</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  cardMe: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.05)' },
  rank: { fontSize: 20, fontWeight: '900', color: p.text, width: 36, textAlign: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  zone: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  verified: { fontSize: 14, fontWeight: '900', color: p.neon },
  reg: { fontSize: 10, color: p.textDim, marginTop: 2 },
});
