import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Image, RefreshControl, Modal, Alert, Share, TextInput, Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const FAV_KEY = 'gaia_history_favorites';

const FILTER_KEYS = [
  { key: 'ALL', label: 'ALL' },
  { key: 'CROPS', type: 'crop', label: 'CROPS' },
  { key: 'PESTS', type: 'pest', label: 'PESTS' },
  { key: 'SOIL', type: 'soil', label: 'SOIL' },
  { key: 'LIVESTOCK', type: 'livestock', label: 'LIVESTOCK' },
];

const DATE_RANGES = [
  { key: 'all', label: 'ALL', days: 99999 },
  { key: 'today', label: 'TODAY', days: 1 },
  { key: 'week', label: '7D', days: 7 },
  { key: 'month', label: '30D', days: 30 },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'NEWEST FIRST' },
  { key: 'oldest', label: 'OLDEST FIRST' },
  { key: 'confidence', label: 'HIGHEST CONFIDENCE' },
];

const CONF_CYCLE = [0, 60, 80, 95];

const TYPE_EMOJI = {
  crop: '🌿', pest: '🐛', soil: '🏞️', livestock: '🐄',
};

// Match model_key → type when `type` column is unreliable
function getScanType(s: any): string {
  const t = String(s.type || '').toLowerCase();
  if (t === 'crop' || t === 'crops' || t === 'crop_disease') return 'crop';
  if (t === 'pest' || t === 'pests') return 'pest';
  if (t === 'soil' || t === 'soil_type') return 'soil';
  if (t === 'livestock' || t === 'animal') return 'livestock';

  const mk = String(s.model_key || '').toLowerCase();
  if (!mk) return 'unknown';
  if (mk.includes('pest')) return 'pest';
  if (mk.includes('soil')) return 'soil';
  if (mk.includes('cattle') || mk.includes('poultry')) return 'livestock';
  if (mk.includes('maize') || mk.includes('rice') || mk.includes('millet') ||
      mk.includes('cassava') || mk.includes('apple') || mk.includes('coffee') ||
      mk.includes('soybean') || mk.includes('pepper') || mk.includes('cabbage') ||
      mk.includes('grape') || mk.includes('tea') || mk.includes('sugarcane')) return 'crop';

  return 'unknown';
}

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
    return { label: String(iso).slice(0, 10), time: '' };
  }
}

export default function History() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [scans, setScans] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [minConf, setMinConf] = useState(0);
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAV_KEY);
        if (raw) setFavorites(new Set(JSON.parse(raw)));
      } catch {}
    })();
  }, []);

  const saveFavorites = async (next: Set<string>) => {
    setFavorites(next);
    try { await AsyncStorage.setItem(FAV_KEY, JSON.stringify(Array.from(next))); } catch {}
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveFavorites(next);
  };

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
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
    let out = scans.slice();
    if (filter !== 'ALL') {
      const target = FILTER_KEYS.find((f) => f.key === filter);
      if (target && target.type) {
        out = out.filter((s) => getScanType(s) === target.type);
      }
    }
    const dr = DATE_RANGES.find((d) => d.key === dateRange);
    if (dr && dr.days < 99999) {
      const cutoff = Date.now() - dr.days * 86400000;
      out = out.filter((s) => new Date(s.created_at).getTime() >= cutoff);
    }
    if (minConf > 0) {
      out = out.filter((s) => (s.confidence || 0) >= minConf);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter((s) => {
        const hay = String(s.top_label || '') + ' ' + String(s.crop || '') + ' ' + String(s.type || '') + ' ' + String(s.model_key || '');
        return hay.toLowerCase().indexOf(q) !== -1;
      });
    }
    if (favoritesOnly) {
      out = out.filter((s) => favorites.has(String(s.id)));
    }
    if (sortBy === 'newest') {
      out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'oldest') {
      out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'confidence') {
      out.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
    return out;
  }, [scans, filter, dateRange, minConf, search, favoritesOnly, favorites, sortBy]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return { total: 0, avg: 0, top: '-' };
    const avg = filtered.reduce((sum, s) => sum + (s.confidence || 0), 0) / filtered.length;
    const counts: Record<string, number> = {};
    filtered.forEach((s) => {
      const lbl = s.top_label || 'Unknown';
      counts[lbl] = (counts[lbl] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { total: filtered.length, avg, top: sorted[0] || '-' };
  }, [filtered]);

  const grouped = useMemo(() => {
    const out: Record<string, any[]> = {};
    filtered.forEach((s) => {
      const { label } = fmtDate(s.created_at);
      if (!out[label]) out[label] = [];
      out[label].push(s);
    });
    return out;
  }, [filtered]);

  const onDelete = (scan: any) => {
    Alert.alert(t('history.delete'), t('history.deleteConfirm'), [
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
    ]);
  };

  const onSpeak = (text: string) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: 'en-GB', rate: 0.95 });
  };

  const buildShareText = (scan: any): string => {
    const nl = String.fromCharCode(10);
    const parts = [
      '🌿 GAIA Diagnosis',
      'Result: ' + (scan.top_label || 'Unknown'),
      'Confidence: ' + Math.round(scan.confidence || 0) + '%',
      'Type: ' + String(scan.type || '').toUpperCase(),
    ];
    if (scan.crop) parts.push('Crop: ' + scan.crop);
    if (scan.recommendation) {
      parts.push('');
      parts.push('Recommendation:');
      parts.push(scan.recommendation);
    }
    parts.push('');
    parts.push('Shared from GAIA by Darkmoor Ltd');
    return parts.join(nl);
  };

  const onShare = async (scan: any) => {
    try {
      await Share.share({ message: buildShareText(scan), title: 'GAIA Diagnosis' });
    } catch {}
  };

  const onWhatsApp = (scan: any) => {
    const url = 'https://wa.me/?text=' + encodeURIComponent(buildShareText(scan));
    Linking.openURL(url).catch(() => Alert.alert('WhatsApp not installed'));
  };

  const onShareImage = async (scan: any) => {
    if (!scan.image_url) { Alert.alert('No image to share'); return; }
    try {
      const local = (FileSystem.cacheDirectory || '') + 'gaia-scan-' + scan.id + '.jpg';
      const dl = FileSystem.createDownloadResumable(scan.image_url, local);
      const res = await dl.downloadAsync();
      if (res && res.uri) {
        await Sharing.shareAsync(res.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share scan image' });
      }
    } catch (e: any) {
      Alert.alert('Image share failed', e?.message || 'Try again');
    }
  };

  const onExportCSV = async () => {
    if (filtered.length === 0) { Alert.alert('No scans to export'); return; }
    const nl = String.fromCharCode(10);
    const header = 'Date,Time,Type,Crop,Result,Confidence,Model' + nl;
    const rows = filtered.map((s) => {
      const fd = fmtDate(s.created_at);
      return [
        fd.label, fd.time,
        s.type || '', s.crop || '',
        '"' + String(s.top_label || '').replace(/"/g, '""') + '"',
        Math.round(s.confidence || 0),
        s.model_key || '',
      ].join(',');
    }).join(nl);
    try {
      await Share.share({
        message: header + rows,
        title: 'GAIA_History_' + new Date().toISOString().slice(0, 10) + '.csv',
      });
    } catch {}
  };

  const onExportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('No scans to export'); return; }
    setPdfBusy(true);
    try {
      const esc = (str: string) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const items = filtered.map((s, i) => {
        const fd = fmtDate(s.created_at);
        return (
          '<div class="scan">' +
            '<div class="row">' +
              '<div class="num">' + (i + 1) + '</div>' +
              '<div class="title">' + esc(s.top_label || 'Unknown') + '</div>' +
              '<div class="pct">' + Math.round(s.confidence || 0) + '%</div>' +
            '</div>' +
            '<div class="meta">' + esc(String(s.type || '').toUpperCase()) + ' · ' + esc(fd.label) + ' ' + esc(fd.time) + '</div>' +
            (s.image_url ? '<img class="img" src="' + esc(s.image_url) + '" />' : '') +
            (s.recommendation ? '<div class="rec"><strong>Recommendation:</strong> ' + esc(s.recommendation) + '</div>' : '') +
          '</div>'
        );
      }).join('');

      const html =
        '<html><head><style>' +
        '@page { margin: 20px; }' +
        'body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; }' +
        'h1 { color: #1b5e20; margin-bottom: 4px; }' +
        '.sub { color: #666; font-size: 12px; margin-bottom: 20px; }' +
        '.scan { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 10px; page-break-inside: avoid; }' +
        '.row { display: flex; align-items: center; margin-bottom: 4px; }' +
        '.num { background: #2e7d32; color: white; width: 24px; height: 24px; border-radius: 12px; text-align: center; font-weight: bold; line-height: 24px; margin-right: 8px; font-size: 12px; }' +
        '.title { flex: 1; font-weight: 700; font-size: 14px; }' +
        '.pct { color: #2e7d32; font-weight: 900; font-size: 16px; }' +
        '.meta { color: #666; font-size: 11px; margin-bottom: 8px; }' +
        '.img { max-width: 180px; max-height: 180px; border-radius: 6px; display: block; margin: 8px 0; }' +
        '.rec { font-size: 11px; color: #333; line-height: 1.5; margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; }' +
        '.footer { text-align: center; color: #999; font-size: 10px; margin-top: 20px; }' +
        '</style></head><body>' +
        '<h1>GAIA Scan History</h1>' +
        '<div class="sub">' + new Date().toLocaleString() + ' · ' + filtered.length + ' scans</div>' +
        items +
        '<div class="footer">Generated by GAIA · Darkmoor Ltd</div>' +
        '</body></html>';

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share GAIA History PDF' });
      } else {
        Alert.alert('PDF saved', uri);
      }
    } catch (e: any) {
      Alert.alert('PDF export failed', e?.message || 'Try again');
    } finally {
      setPdfBusy(false);
    }
  };

  const cycleConf = () => {
    const idx = CONF_CYCLE.indexOf(minConf);
    setMinConf(CONF_CYCLE[(idx + 1) % CONF_CYCLE.length]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t('history.title')}</Text>
        <Text style={styles.subtitle}>{t('history.subtitle')}</Text>

        {filtered.length > 0 && (
          <View style={styles.statsBar}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{stats.total}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{Math.round(stats.avg)}%</Text>
              <Text style={styles.statLabel}>AVG</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statVal} numberOfLines={1}>{String(stats.top).slice(0, 12)}</Text>
              <Text style={styles.statLabel}>TOP</Text>
            </View>
          </View>
        )}

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search crop, disease, type"
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTER_KEYS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, filter === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DATE_RANGES.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setDateRange(d.key)}
                style={[styles.chipSmall, dateRange === d.key && styles.chipActive]}
              >
                <Text style={[styles.chipSmallText, dateRange === d.key && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.toolbar}>
          <Pressable onPress={() => setSortOpen(true)} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>⇅</Text>
          </Pressable>
          <Pressable onPress={cycleConf} style={styles.toolBtn}>
            <Text style={[styles.toolBtnText, minConf > 0 && { color: palette.neon }]}>
              {minConf === 0 ? 'CONF' : '≥' + minConf + '%'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setFavoritesOnly(!favoritesOnly)} style={styles.toolBtn}>
            <Text style={[styles.toolBtnText, favoritesOnly && { color: '#ffcc00' }]}>★</Text>
          </Pressable>
          <Pressable onPress={onExportPDF} style={styles.toolBtn} disabled={pdfBusy}>
            {pdfBusy ? <ActivityIndicator color={palette.neon} size="small" /> : <Text style={styles.toolBtnText}>PDF</Text>}
          </Pressable>
          <Pressable onPress={onExportCSV} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>CSV</Text>
          </Pressable>
        </View>

        <Text style={styles.countText}>{filtered.length} scans</Text>

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

        {!busy && Object.keys(grouped).map((dayLabel) => (
          <View key={dayLabel} style={{ marginTop: 16 }}>
            <Text style={styles.dayHeader}>{dayLabel.toUpperCase()}</Text>
            {grouped[dayLabel].map((s) => {
              const time = fmtDate(s.created_at).time;
              const st = getScanType(s);
              const emoji = s.emoji || TYPE_EMOJI[st] || '📷';
              const thumb = s.thumbnail_url || s.image_url;
              const isFav = favorites.has(String(s.id));
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
                      {st.toUpperCase()} · {time}
                    </Text>
                  </View>
                  <Pressable onPress={() => toggleFavorite(String(s.id))} hitSlop={10} style={{ paddingHorizontal: 6 }}>
                    <Text style={{ fontSize: 18, color: isFav ? '#ffcc00' : palette.textDim }}>
                      {isFav ? '★' : '☆'}
                    </Text>
                  </Pressable>
                  <Text style={styles.score}>{Math.round(s.confidence || 0)}%</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable onPress={() => setSortOpen(false)} style={styles.sortOverlay}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Sort by</Text>
            {SORT_OPTIONS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => { setSortBy(s.key); setSortOpen(false); }}
                style={[styles.sortRow, sortBy === s.key && styles.sortRowActive]}
              >
                <Text style={[styles.sortRowText, sortBy === s.key && { color: palette.neon }]}>
                  {s.label}
                </Text>
                {sortBy === s.key ? <Text style={{ color: palette.neon }}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

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

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.modalTitle, { flex: 1 }]}>{selected.top_label || 'Unknown'}</Text>
                    <Pressable onPress={() => toggleFavorite(String(selected.id))} hitSlop={10}>
                      <Text style={{ fontSize: 28, color: favorites.has(String(selected.id)) ? '#ffcc00' : palette.textDim }}>
                        {favorites.has(String(selected.id)) ? '★' : '☆'}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.modalBigScore, { color: palette.neon }]}>
                    {Math.round(selected.confidence || 0)}% {t('history.confidence')}
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>{t('history.type')}</Text>
                    <Text style={styles.detailVal}>{getScanType(selected).toUpperCase()}</Text>
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
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>{t('history.scanDate')}</Text>
                    <Text style={styles.detailVal}>
                      {fmtDate(selected.created_at).label} {fmtDate(selected.created_at).time}
                    </Text>
                  </View>

                  {selected.recommendation ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>RECOMMENDATION</Text>
                        <Pressable onPress={() => onSpeak(selected.recommendation)} hitSlop={8}>
                          <Text style={{ color: palette.neon, fontSize: 18 }}>🔊</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.recommendationText}>{selected.recommendation}</Text>
                    </>
                  ) : null}

                  <View style={styles.actionRow}>
                    <Pressable onPress={() => onShare(selected)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>📤 TEXT</Text>
                    </Pressable>
                    <Pressable onPress={() => onShareImage(selected)} style={[styles.actionBtn, { borderColor: '#ff9800' }]}>
                      <Text style={[styles.actionBtnText, { color: '#ff9800' }]}>📷 IMAGE</Text>
                    </Pressable>
                    <Pressable onPress={() => onWhatsApp(selected)} style={[styles.actionBtn, { borderColor: '#25d366' }]}>
                      <Text style={[styles.actionBtnText, { color: '#25d366' }]}>WA</Text>
                    </Pressable>
                  </View>

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
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 24, color: palette.neon, fontWeight: '300', lineHeight: 26 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  countText: { ...typography.micro, color: palette.textDim, marginTop: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipSmall: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipSmallText: { fontSize: 10, color: palette.textMuted, fontWeight: '700', letterSpacing: 1 },
  chipActive: { backgroundColor: palette.neonSoft, borderColor: palette.borderHi },
  chipText: { ...typography.micro, color: palette.textMuted, fontWeight: '700' },
  chipTextActive: { color: palette.neon },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', marginTop: 40 },
  dayHeader: { ...typography.micro, color: palette.textMuted, letterSpacing: 1.5, marginBottom: 8 },
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
  errorBox: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: palette.danger, marginTop: 20 },
  errorText: { color: palette.danger, fontSize: 13 },
  retryBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: palette.danger, alignItems: 'center' },
  retryText: { color: '#fff', fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: palette.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' },
  modalClose: { color: palette.textMuted, fontWeight: '800', letterSpacing: 1.5, fontSize: 11, marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginTop: 12 },
  modalBigScore: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  fullImage: { width: '100%', height: 260, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailKey: { fontSize: 12, color: palette.textMuted },
  detailVal: { fontSize: 13, color: palette.text, fontWeight: '700' },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: 16, marginBottom: 6, letterSpacing: 1.5 },
  recommendationText: { fontSize: 13, color: palette.text, lineHeight: 20 },
  deleteBtn: { marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: palette.danger, alignItems: 'center' },
  deleteText: { color: palette.danger, fontWeight: '900', letterSpacing: 1 },
  statsBar: {
    marginTop: spacing.md, padding: 14, borderRadius: 14,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    flexDirection: 'row', alignItems: 'center',
  },
  statCol: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: palette.neon },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: palette.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: palette.border },
  searchBox: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 0 },
  toolbar: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  toolBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface,
    alignItems: 'center',
  },
  toolBtnText: { fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.5 },
  sortOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  sortSheet: { backgroundColor: palette.abyss, borderRadius: 16, padding: 20, minWidth: 280 },
  sortTitle: { fontSize: 16, fontWeight: '900', color: palette.text, marginBottom: 12 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sortRowActive: { backgroundColor: 'rgba(0,255,136,0.08)' },
  sortRowText: { fontSize: 13, fontWeight: '700', color: palette.text },
  actionRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: palette.borderHi, alignItems: 'center' },
  actionBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: palette.neon },
});
