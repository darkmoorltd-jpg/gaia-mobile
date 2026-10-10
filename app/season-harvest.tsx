import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function SeasonHarvest() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [decision, setDecision] = useState<any>(null);
  const [asking, setAsking] = useState(false);

  const [actualYield, setActualYield] = useState('');
  const [actualRevenue, setActualRevenue] = useState('');
  const [buyer, setBuyer] = useState('');
  const [recording, setRecording] = useState(false);

  const askGAIA = async () => {
    setAsking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch(API_BASE + '/season/harvest-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          crop: 'Maize', days_since_planting: 100, days_to_harvest: 10,
          state: null, language: 'en', recent_events: [],
          market_price_naira_per_kg: null,
        }),
      });
      if (r.ok) setDecision(await r.json());
    } catch {}
    setAsking(false);
  };

  const recordHarvest = async () => {
    if (!params.id) return;
    const y = parseFloat(actualYield);
    const rev = parseFloat(actualRevenue);
    setRecording(true);
    const { error: e1 } = await supabase.rpc('season_log_event', {
      p_season_id: params.id, p_kind: 'harvest', p_label: 'Harvest recorded',
      p_stage: 'harvest', p_cost_naira: 0, p_detail: { yield_kg: y }, p_image_url: null,
    });
    if (!e1 && isFinite(rev) && rev > 0) {
      await supabase.from('season_revenue').insert({
        season_id: params.id, user_id: (await supabase.auth.getUser()).data.user?.id,
        source: 'harvest', buyer: buyer || null,
        quantity_kg: isFinite(y) ? y : null,
        price_per_kg: isFinite(y) && y > 0 ? rev / y : null,
        amount_naira: rev,
      });
    }
    await supabase.from('seasons').update({
      status: 'completed', actual_harvest_date: new Date().toISOString().slice(0, 10),
      actual_yield_kg: isFinite(y) ? y : null,
      actual_revenue_naira: isFinite(rev) ? rev : null,
      current_stage: 'postharvest', updated_at: new Date().toISOString(),
    }).eq('id', params.id);
    setRecording(false);
    router.replace(('/season-reveal?id=' + params.id) as any);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
      <Text style={styles.title}>Harvest</Text>

      <Pressable onPress={askGAIA} disabled={asking} style={styles.askBtn}>
        {asking ? <ActivityIndicator color="#000" /> : <Text style={styles.askTxt}>ASK GAIA WHEN TO HARVEST</Text>}
      </Pressable>

      {decision ? (
        <View style={styles.decisionCard}>
          <Text style={styles.decisionLabel}>DECISION</Text>
          <Text style={styles.decisionText}>{decision.decision}</Text>
          {decision.reason ? <Text style={styles.decisionReason}>{decision.reason}</Text> : null}
          {decision.action ? <Text style={styles.decisionAction}>→ {decision.action}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.label}>ACTUAL YIELD (KG)</Text>
      <TextInput value={actualYield} onChangeText={setActualYield} keyboardType="numeric"
        placeholder="e.g. 2400" placeholderTextColor={palette.textDim} style={styles.input} />

      <Text style={styles.label}>TOTAL REVENUE (NAIRA)</Text>
      <TextInput value={actualRevenue} onChangeText={setActualRevenue} keyboardType="numeric"
        placeholder="e.g. 480000" placeholderTextColor={palette.textDim} style={styles.input} />

      <Text style={styles.label}>BUYER (OPTIONAL)</Text>
      <TextInput value={buyer} onChangeText={setBuyer}
        placeholder="e.g. Dawanau trader" placeholderTextColor={palette.textDim} style={styles.input} />

      <Pressable onPress={recordHarvest} disabled={recording} style={[styles.cta, recording && { opacity: 0.5 }]}>
        {recording ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>RECORD HARVEST & CLOSE SEASON</Text>}
      </Pressable>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  askBtn: { marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  askTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1.4 },
  decisionCard: { marginTop: 20, padding: 18, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  decisionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  decisionText: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 6 },
  decisionReason: { fontSize: 12, color: p.textMuted, marginTop: 8, lineHeight: 18 },
  decisionAction: { fontSize: 13, fontWeight: '700', color: p.neon, marginTop: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { marginTop: 28, padding: 18, borderRadius: 14, backgroundColor: p.warning, alignItems: 'center' },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1.4 },
});
