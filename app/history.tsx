import { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Image, RefreshControl, Modal, Alert, Share,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const FILTER_KEYS = [
  { key: 'ALL',       type: null,        labelKey: 'history.filters.all' },
  { key: 'CROPS',     type: 'crop',      labelKey: 'history.filters.crops' },
  { key: 'PESTS',     type: 'pest',      labelKey: 'history.filters.pests' },
  { key: 'SOIL',      type: 'soil',      labelKey: 'history.filters.soil' },
  { key: 'LIVESTOCK', type: 'livestock', labelKey: 'history.filters.livestock' },
];

const TYPE_EMOJI: Record<string, string> = {
  crop: '🌿', pest: '🐛', soil: '🏞️', livestock: '🐄',
};

function fmtDate(iso: string): { label: string; time: string } {
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let label: string;
    if (day.getTime() === today.getTime()) label = 'Today';
    else if (day.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return { label, time };
  } catch {
    return { label: iso.slice(0, 10), time: '' };
  }
}

export default function History() {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [scans, setScans] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);
      if (err) { setError(err.message); setScans([]); }
      else setScans(data || []);
    } catch (e: any) {
      setError(e?.message || 'error');
      setScans([]);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { setBusy(true); load(); }, [load]));

  const filtered = useMemo(() => {
    if (filter === 'ALL') return scans;
    const target = FILTER_KEYS.find((f) => f.key === filter)?.type;
    if (!target) return scans;
    return scans.filter((s) => String(s.type || '').toLowerCase() === target);
  }, [scans, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const s of filtered) {
      const { label } = fmtDate(s.created_at);
      if (!out[label]) out[label] = [];
      out[label].push(s);
    }
    return out;
  }, [filtered]);

  const onDelete = (scan: any) => {
    Alert.alert(
      t('history.delete'),
      t('history.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('history.delete'), style: 'destructive', onPress: async () => {
          try {
            await supabase.from('scan_history').delete().eq('id', scan.id);
            setScans((prev) => prev.filter((s) => s.id !== scan.id));
            setSelected(null);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Delete failed');
          }
        }},
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />
        }
      >
        <Text style={styles.title}>{t('history.title')}</Text>
        <Text style={styles.subtitle}>{t('history.subtitle')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTER_KEYS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, filter === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                  {t(f.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.countText}>{t('history.filtered', { count: filtered.length })}</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {!busy && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('history.error')}: {error}</Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t('history.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!busy && !error && filtered.length === 0 ? (
          <Text style={styles.empty}>{t('history.empty')}</Text>
        ) : null}

        {!busy && Object.entries(grouped).map(([dayLabel, items]) => (
          <View key={dayLabel} style={{ marginTop: 16 }}>
            <Text style={styles.dayHeader}>{dayLabel.toUpperCase()}</Text>
            {items.map((s) => {
              const time = fmtDate(s.created_at).time;
              const emoji = s.emoji || TYPE_EMOJI[String(s.type || '').toLowerCase()] || '📷';
              const thumb = s.thumbnail_url || s.image_url;
              return (
                <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.card}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={styles.thumbEmoji}>{emoji}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{s.top_label || 'Unknown'}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {String(s.type || '').toUpperCase()} · {time}
                    </Text>
                  </View>
                  <Text style={styles.score}>{Math.round(s.confidence || 0)}%</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>{t('history.close')}</Text>
              </Pressable>

              {selected && (
                <>
                  {selected.image_url ? (
                    <Image source={{ uri: selected.image_url }} style={styles.fullImage} resizeMode="contain" />
                  ) : null}

                  <Text style={styles.modalTitle}>{selected.top_label || 'Unknown'}</Text>
                  <Text style={[styles.modalBigScore, { color: palette.neon }]}>
                    {Math.round(selected.confidence || 0)}% {t('history.confidence')}
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>{t('history.type')}</Text>
                    <Text style={styles.detailVal}>{String(selected.type || '-').toUpperCase()}</Text>
                  </View>
                  {selected.crop ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>{t('history.crop')}</Text>
                      <Text style={styles.detailVal}>{selected.crop}</Text>
                    </View>
                  ) : null}
                  {selected.model_key ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>{t('history.model')}</Text>
                      <Text style={styles.detailVal}>{selected.model_key}</Text>
                    </View>
                  ) : null}
                  {selected.on_device != null ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>{t('history.onDevice')}</Text>
                      <Text style={styles.detailVal}>{selected.on_device ? 'Yes' : 'No'}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>{t('history.scanDate')}</Text>
                    <Text style={styles.detailVal}>
                      {fmtDate(selected.created_at).label} {fmtDate(selected.created_at).time}
                    </Text>
                  </View>

                  {selected.recommendation ? (
                    <>
                      <Text style={styles.sectionLabel}>RECOMMENDATION</Text>
                      <Text style={styles.recommendationText}>{selected.recommendation}</Text>
                    </>
                  ) : null}

                  <Pressable onPress={() => onDelete(selected)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>{t('history.delete')}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 56 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  countText: { ...typography.micro, color: palette.textDim, marginTop: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipActive: { backgroundColor: palette.neonSoft, borderColor: palette.borderHi },
  chipText: { ...typography.micro, color: palette.textMuted, fontWeight: '700' },
  chipTextActive: { color: palette.neon },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', marginTop: 40 },
  dayHeader: {
    ...typography.micro, color: palette.textMuted,
    letterSpacing: 1.5, marginBottom: 8,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border, marginBottom: 8,
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 26 },
  itemTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  itemSub: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  score: { fontSize: 18, fontWeight: '900', color: palette.neon },
  errorBox: {
    padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,59,92,0.1)',
    borderWidth: 1, borderColor: palette.danger, marginTop: 20,
  },
  errorText: { color: palette.danger, fontSize: 13 },
  retryBtn: {
    marginTop: 10, paddingVertical: 10, borderRadius: 8,
    backgroundColor: palette.danger, alignItems: 'center',
  },
  retryText: { color: '#fff', fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: palette.abyss,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '94%',
  },
  modalClose: { color: palette.textMuted, fontWeight: '800', letterSpacing: 1.5, fontSize: 11, marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginTop: 12 },
  modalBigScore: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  fullImage: {
    width: '100%', height: 260, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailKey: { fontSize: 12, color: palette.textMuted },
  detailVal: { fontSize: 13, color: palette.text, fontWeight: '700' },
  sectionLabel: {
    ...typography.micro, color: palette.textMuted,
    marginTop: 16, marginBottom: 6, letterSpacing: 1.5,
  },
  recommendationText: { fontSize: 13, color: palette.text, lineHeight: 20 },
  deleteBtn: {
    marginTop: 20, padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: palette.danger, alignItems: 'center',
  },
  deleteText: { color: palette.danger, fontWeight: '900', letterSpacing: 1 },
});
