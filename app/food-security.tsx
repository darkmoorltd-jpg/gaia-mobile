import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function FoodSecurity() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [rows, setRows] = useState<any[]>([]);
  const [crop, setCrop] = useState('Maize');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from('food_security_index').select('*').eq('crop', crop).order('supply_tonnes', { ascending: false });
    setRows(data || []);
    setBusy(false);
  };

  useEffect(() => { load(); }, [crop]);

  const totalSupply = rows.reduce((a, b) => a + Number(b.supply_tonnes), 0);
  const totalDemand = rows.reduce((a, b) => a + Number(b.demand_tonnes), 0);
  const nationalGap = totalSupply - totalDemand;

  const surplus = rows.filter(r => Number(r.supply_tonnes) > Number(r.demand_tonnes));
  const deficit = rows.filter(r => Number(r.supply_tonnes) < Number(r.demand_tonnes));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Food Security Index</Text>
        <Text style={styles.sub}>Surplus vs deficit by state · {crop}</Text>

        <View style={styles.cropRow}>
          {['Maize','Rice'].map(c => (
            <Pressable key={c} onPress={() => setCrop(c)} style={[styles.cropBtn, crop === c && styles.cropActive]}>
              <Text style={[styles.cropTxt, crop === c && { color: '#000' }]}>{c.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{totalSupply.toLocaleString()}t</Text>
            <Text style={styles.kpiLbl}>SUPPLY</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{totalDemand.toLocaleString()}t</Text>
            <Text style={styles.kpiLbl}>DEMAND</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: nationalGap >= 0 ? palette.neon : '#ff3b5c' }]}>
              {nationalGap >= 0 ? '+' : ''}{nationalGap.toLocaleString()}t
            </Text>
            <Text style={styles.kpiLbl}>NATIONAL GAP</Text>
          </View>
        </View>

        {surplus.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>🟢 SURPLUS STATES</Text>
            {surplus.map(r => {
              const gap = Number(r.supply_tonnes) - Number(r.demand_tonnes);
              return (
                <View key={r.id} style={[styles.card, { borderLeftColor: palette.neon }]}>
                  <Text style={styles.stateName}>{r.state}</Text>
                  <Text style={styles.stateVal}>+{gap.toLocaleString()}t surplus</Text>
                </View>
              );
            })}
          </>
        )}

        {deficit.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>🔴 DEFICIT STATES</Text>
            {deficit.map(r => {
              const gap = Number(r.demand_tonnes) - Number(r.supply_tonnes);
              return (
                <View key={r.id} style={[styles.card, { borderLeftColor: '#ff3b5c' }]}>
                  <Text style={styles.stateName}>{r.state}</Text>
                  <Text style={[styles.stateVal, { color: '#ff3b5c' }]}>-{gap.toLocaleString()}t needed</Text>
                </View>
              );
            })}
          </>
        )}

        {surplus.length > 0 && deficit.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>🔄 RECOMMENDED TRANSFERS</Text>
            {surplus.slice(0, 2).map((s, i) => {
              const d = deficit[i];
              if (!d) return null;
              const surplusAmt = Number(s.supply_tonnes) - Number(s.demand_tonnes);
              const deficitAmt = Number(d.demand_tonnes) - Number(d.supply_tonnes);
              const moveAmt = Math.min(surplusAmt, deficitAmt);
              return (
                <View key={s.id + d.id} style={styles.transferCard}>
                  <Text style={styles.transferTitle}>Move {moveAmt.toLocaleString()}t {crop}</Text>
                  <Text style={styles.transferDetail}>{s.state} → {d.state}</Text>
                  <Text style={styles.transferImpact}>Estimated value: ₦{(moveAmt * 450000).toLocaleString()}</Text>
                </View>
              );
            })}
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  cropRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cropBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  cropActive: { backgroundColor: p.neon, borderColor: p.neon },
  cropTxt: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  kpi: { flex: 1, backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 18, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: p.border, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stateName: { fontSize: 15, fontWeight: '900', color: p.text },
  stateVal: { fontSize: 13, fontWeight: '800', color: p.neon },
  transferCard: { backgroundColor: 'rgba(0,255,136,0.08)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.neon, marginBottom: 8 },
  transferTitle: { fontSize: 15, fontWeight: '900', color: p.neon },
  transferDetail: { fontSize: 13, color: p.text, marginTop: 4 },
  transferImpact: { fontSize: 11, color: p.textMuted, marginTop: 6, fontStyle: 'italic' },
});
