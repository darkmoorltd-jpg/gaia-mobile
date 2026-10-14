import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';

export default function VideoSessionReport() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [sess, setSess] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase.from('scan_sessions').select('*').eq('id', Number(id)).maybeSingle();
      setSess(data);
      setBusy(false);
    })();
  }, [id]);

  const share = async () => {
    if (!sess) return;
    const lines = [
      '═══════════════════════════════════════',
      '       GAIA VIDEO SCAN REPORT',
      '═══════════════════════════════════════',
      '',
      `Crop:          ${(sess.crop || '').replace('_', ' ')}`,
      `Verdict:       ${sess.consensus_label || '—'}`,
      `Confidence:    ${Number(sess.consensus_conf || 0).toFixed(1)}%`,
      `Votes:         ${sess.vote_count} / ${sess.vote_total} frames`,
      `Severity:      ${sess.severity_pct || 0}%`,
      `Frames:        ${sess.frames_analyzed || 0}`,
      `Plants counted:${sess.plants_count || 0}`,
      `Infected count:${sess.infected_count || 0}`,
      `Duration:      ${sess.duration_sec || 0} seconds`,
      `Grid mode:     ${sess.grid_mode ? 'yes' : 'no'}`,
      '',
      `Date:          ${new Date(sess.created_at).toLocaleString()}`,
      `Location:      ${sess.location_label || '—'}`,
      `GPS:           ${sess.gps_lat && sess.gps_lon ? sess.gps_lat.toFixed(4) + ', ' + sess.gps_lon.toFixed(4) : '—'}`,
      '',
      sess.advice ? '────────── ACTION PLAN ──────────' : '',
      sess.advice || '',
      '',
      '═══════════════════════════════════════',
      'GAIA · Powered by Darkmoor Ltd',
      '═══════════════════════════════════════',
    ];
    const text = lines.filter(Boolean).join('\n');
    const path = FileSystem.cacheDirectory + 'gaia-scan-' + sess.id + '.txt';
    await FileSystem.writeAsStringAsync(path, text);
    await Share.share({ message: text, url: path });
  };

  if (busy) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!sess) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Report not found</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>SCAN REPORT</Text>
        <Text style={styles.title}>#{sess.id} · {(sess.crop || '').replace('_', ' ')}</Text>

        <View style={[styles.hero, { borderColor: sess.consensus_label?.toLowerCase().includes('healthy') ? palette.neon : palette.warning }]}>
          <Text style={styles.heroLabel}>{sess.consensus_label || '—'}</Text>
          <Text style={styles.heroConf}>{Number(sess.consensus_conf || 0).toFixed(1)}%</Text>
        </View>

        <View style={styles.statGrid}>
          <S k="FRAMES" v={String(sess.frames_analyzed || 0)} styles={styles} />
          <S k="VOTES" v={`${sess.vote_count || 0}/${sess.vote_total || 0}`} styles={styles} />
          <S k="SEVERITY" v={`${sess.severity_pct || 0}%`} styles={styles} />
          <S k="PLANTS" v={String(sess.plants_count || 0)} styles={styles} />
          <S k="INFECTED" v={String(sess.infected_count || 0)} styles={styles} />
          <S k="DURATION" v={`${sess.duration_sec || 0}s`} styles={styles} />
        </View>

        {sess.gps_lat && sess.gps_lon ? (
          <View style={styles.meta}>
            <Text style={styles.metaLine}>📍 {sess.gps_lat.toFixed(4)}, {sess.gps_lon.toFixed(4)}</Text>
          </View>
        ) : null}

        {sess.advice ? (
          <View style={styles.adviceCard}>
            <Text style={styles.adviceTitle}>ACTION PLAN</Text>
            <MarkdownOutput content={sess.advice} />
          </View>
        ) : null}

        <Pressable onPress={share} style={styles.cta}>
          <Text style={styles.ctaText}>SHARE REPORT</Text>
        </Pressable>

        <Text style={styles.footer}>GAIA · Darkmoor Ltd</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function S({ k, v, styles }: any) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{v}</Text>
      <Text style={styles.statKey}>{k}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 24, fontWeight: '900', color: p.text, letterSpacing: -0.5, marginTop: 4, marginBottom: 16 },
  hero: { padding: 24, borderRadius: 20, backgroundColor: p.surface, borderWidth: 2, alignItems: 'center' },
  heroLabel: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  heroConf: { fontSize: 16, fontWeight: '800', color: p.neon, marginTop: 6 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stat: { width: '31%', padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: p.neon },
  statKey: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 3 },
  meta: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginTop: 12 },
  metaLine: { fontSize: 12, color: p.text },
  adviceCard: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginTop: 16 },
  adviceTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 8 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  footer: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 30, letterSpacing: 1 },
});
