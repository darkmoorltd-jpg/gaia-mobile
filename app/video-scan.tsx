import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput,
  Alert, Modal, Animated, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { diagnose } from '../src/api/models';
import { logScan } from '../src/utils/scanLog';
import { getSession, runModel, softmax, imageUriToTensor, getLabels } from '../src/utils/onDeviceModel';
import { MarkdownOutput } from '../src/components/MarkdownOutput';
import Sparkline from '../src/components/Sparkline';
import { gridScan, countDistinctSubjects } from '../src/utils/scanGrid';
import { enqueueScan, listQueue, removeFromQueue, queueSize } from '../src/utils/offlineQueue';
import { shareToWhatsApp, sendSmsReport } from '../src/utils/shareHelpers';
import { t as tr, cropLabel as trCrop, detectLangFromText, Lang } from '../src/utils/cropTranslations';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { resolveLanguage } from '../src/utils/language';
import { useTranslation } from 'react-i18next';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const FRAME_INTERVAL_MS = 1500;
const MAX_FRAMES = 15;
const HEALTHY_AUTOSTOP_FRAMES = 5;

const CROPS = [
  { key: 'maize', label: 'Maize', onDeviceKey: null },
  { key: 'rice_6class', label: 'Rice', onDeviceKey: null },
  { key: 'pests_102class', label: 'Pests', onDeviceKey: 'pests_102class_v2' },
  { key: 'soil_11class', label: 'Soil', onDeviceKey: 'soil_11class' },
  { key: 'poultry', label: 'Poultry', onDeviceKey: 'poultry' },
  { key: 'pineapple', label: 'Pineapple', onDeviceKey: 'pineapple' },
];

const LABELS_BY_KEY: Record<string, string[]> = {
  maize: ['Blight', 'Common_Rust', 'Gray_Leaf_Spot', 'Healthy'],
  rice_6class: ['Bacterial Leaf Blight', 'Brown Spot', 'Healthy', 'Leaf Blast', 'Leaf Scald', 'Neck Blast'],
  pests_102class: [],
  soil_11class: ['Alluvial','Sandy','Clay','Loamy','Laterite','Black','Red','Peat','Cinder','Sandy Loam','Yellow'],
  poultry: ['Coccidiosis','Healthy','Newcastle Disease','Salmonella'],
};

function detectLanguage(text: string): string {
  const t = ' ' + (text || '').toLowerCase() + ' ';
  if (/\b(barka|sannu|nagode)\b/.test(t)) return 'ha-NG';
  if (/\b(bawo|ese|jowo)\b/.test(t)) return 'yo-NG';
  if (/\b(kedu|daalu)\b/.test(t)) return 'ig-NG';
  if (/\b(wetin|dey)\b/.test(t)) return 'en-NG';
  return 'en-NG';
}

export default function VideoScan() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, refreshScans } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      const labels = await getLabels('pests_102class_v2');
      if (labels.length > 0) {
        LABELS_BY_KEY.pests_102class = labels;
      }
    })();
  }, []);
  const [crop, setCrop] = useState(CROPS[0]);
  const [scanning, setScanning] = useState(false);
  const [frames, setFrames] = useState<any[]>([]);
  const [consensus, setConsensus] = useState<any | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoStopOnHealthy, setAutoStopOnHealthy] = useState(true);
  const [gridMode, setGridMode] = useState(false);
  const [quadResults, setQuadResults] = useState<any[]>([]);
  const [growthSiteId, setGrowthSiteId] = useState<string | null>(null);
  const [growthSiteLabel, setGrowthSiteLabel] = useState('');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [nearby, setNearby] = useState<any[]>([]);
  const [previousLabel, setPreviousLabel] = useState<string | null>(null);
  const [changeAlarm, setChangeAlarm] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [queueCount, setQueueCount] = useState(0);
  const [smsPhone, setSmsPhone] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const stopFlag = useRef(false);
  const healthyStreak = useRef(0);
  const sessionStart = useRef<number>(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const n = await queueSize();
        setQueueCount(n);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startScan = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) { setError('Camera permission required'); return; }
    }
    setScanning(true);
    setFrames([]);
    setQuadResults([]);
    setConsensus(null);
    setAdvice(null);
    setNearby([]);
    setChangeAlarm(false);
    setError('');
    setCountdown(3);
    stopFlag.current = false;
    healthyStreak.current = 0;
    sessionStart.current = Date.now();

    // capture GPS silently
    (async () => {
      try {
        setGpsLoading(true);
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setGps({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        }
      } catch {}
      setGpsLoading(false);
    })();

    // 3-2-1 countdown
    for (let n = 3; n > 0; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(0);

    tick();
  };

  const tick = async () => {
    if (stopFlag.current) return;
    if (frames.length >= MAX_FRAMES) {
      await finishSession();
      return;
    }
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (photo?.uri) {
        let result: any = null;

        // GRID MODE — 5-region scan
        if (gridMode) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const tok = session?.access_token;
            const quads = await gridScan(
              photo.uri, crop.key, LABELS_BY_KEY[crop.key] || [], crop.onDeviceKey, 224, tok,
            );
            if (quads.length > 0) {
              setQuadResults(quads);
              // majority vote
              const counts: Record<string, number> = {};
              quads.forEach((q) => { counts[q.label] = (counts[q.label] || 0) + 1; });
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
              const winnerQuads = quads.filter((q) => q.label === top[0]);
              const avgConf = winnerQuads.reduce((s, q) => s + q.confidence, 0) / winnerQuads.length;
              result = { top: { label: top[0], confidence: avgConf }, source: 'grid' };
            }
          } catch (e) { /* fall through */ }
        }

        // 1. Try on-device first
        if (crop.onDeviceKey) {
          try {
            const sess = await getSession(crop.onDeviceKey);
            if (sess) {
              const H = crop.onDeviceKey === 'soil_11class' ? 384 : 224;
              const tensor = await imageUriToTensor(photo.uri, H, H);
              if (tensor) {
                const out = await runModel(crop.onDeviceKey, tensor, H, H);
                if (out) {
                  const probs = softmax(out.logits);
                  const topIdx = probs.indexOf(Math.max(...probs));
                  const labels = LABELS_BY_KEY[crop.key] || [];
                  result = {
                    top: {
                      label: labels[topIdx] || `Class ${topIdx}`,
                      confidence: probs[topIdx] * 100,
                    },
                    source: 'on-device',
                  };
                }
              }
            }
          } catch (e) { /* fall through to server */ }
        }

        // 2. Fall back to server
        if (!result) {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? '';
          const res = await diagnose(photo.uri, crop.key, token);
          result = { top: res.top, source: 'server' };
        }

        // 3. Haptic feedback
        Haptics.impactAsync(
          result.top.label.toLowerCase().includes('healthy')
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium
        );

        setFrames((prev) => [
          ...prev,
          { label: result.top.label, conf: result.top.confidence, at: new Date().toLocaleTimeString() },
        ]);

        // 4. Auto-stop if healthy streak
        if (autoStopOnHealthy && result.top.label.toLowerCase().includes('healthy')) {
          healthyStreak.current += 1;
          if (healthyStreak.current >= HEALTHY_AUTOSTOP_FRAMES) {
            stopFlag.current = true;
            setScanning(false);
            await finishSession();
            return;
          }
        } else {
          healthyStreak.current = 0;
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Frame failed');
    }
    if (!stopFlag.current) setTimeout(tick, FRAME_INTERVAL_MS);
  };

  const stopScan = async () => {
    stopFlag.current = true;
    setScanning(false);
    await finishSession();
  };

  const finishSession = async () => {
    const snapshot = frames;
    if (snapshot.length === 0) return;

    // Consensus voting
    const tally: Record<string, { count: number; conf: number }> = {};
    for (const f of snapshot) {
      if (!tally[f.label]) tally[f.label] = { count: 0, conf: 0 };
      tally[f.label].count += 1;
      tally[f.label].conf += f.conf;
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1].count - a[1].count);
    const [winnerLabel, winnerStats] = sorted[0];
    const winner: any = {
      label: winnerLabel,
      confidence: winnerStats.conf / winnerStats.count,
      voteCount: winnerStats.count,
      voteTotal: snapshot.length,
      agreePct: (winnerStats.count / snapshot.length) * 100,
    };

    // Severity estimate (rough — inverse of confidence on healthy)
    const isHealthy = winnerLabel.toLowerCase().includes('healthy');
    const severity = isHealthy ? 0 : Math.max(5, Math.round(100 - winner.confidence));
    winner.severity = severity;

    setConsensus(winner);

    // Persist to unified scan_history (non-blocking)
    try {
      const topPreds = sorted.slice(0, 5).map(([lbl, stats]) => ({
        label: lbl,
        confidence: (stats.conf / stats.count) * 100,
      }));
      await logScan({
        type: 'video',
        model_key: crop.key,
        top_label: winnerLabel,
        confidence: winner.confidence,
        all_predictions: topPreds,
        image_uri: (snapshot[0] as any)?.uri || null,
        gps_lat: gps?.lat ?? null,
        gps_lon: gps?.lon ?? null,
        on_device: !!crop.onDeviceKey,
        inference_ms: 0,
      });
    } catch (e) {
      console.warn('[video-scan] scan_history log failed', e);
    }


    // Change alarm — detect sudden flip
    if (previousLabel && previousLabel !== winnerLabel) {
      const wasHealthy = previousLabel.toLowerCase().includes('healthy');
      const nowHealthy = winnerLabel.toLowerCase().includes('healthy');
      const nowDiseased = !nowHealthy;
      const severitySpike = severity > 40;
      if ((wasHealthy && nowDiseased) || severitySpike) {
        setChangeAlarm(true);
        try { Vibration.vibrate([100, 100, 100, 100, 100]); } catch {}
        try {
          Speech.speak(
            `Alert. Change detected. Now ${winnerLabel}. Severity ${severity} percent.`,
            { language: detectLanguage(winnerLabel), rate: 0.95 },
          );
        } catch {}
      }
    }
    setPreviousLabel(winnerLabel);

    // Growth site auto-save (features 13/14)
    let autoGrowthSiteId: string | null = growthSiteId;
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (me && gps) {
        // look for existing site within 30m
        const { data: sites } = await supabase
          .from('growth_sites')
          .select('id,gps_lat,gps_lon,label')
          .eq('user_id', me.id)
          .eq('crop', crop.key);
        let nearest: any = null;
        let nearestDist = Infinity;
        for (const s of (sites || [])) {
          if (!s.gps_lat || !s.gps_lon) continue;
          const dx = (s.gps_lat - gps.lat) * 111000;
          const dy = (s.gps_lon - gps.lon) * 111000 * Math.cos(gps.lat * Math.PI / 180);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) { nearestDist = d; nearest = s; }
        }
        if (nearest && nearestDist < 30) {
          autoGrowthSiteId = nearest.id;
        } else {
          const { data: created } = await supabase.from('growth_sites').insert({
            user_id: me.id,
            crop: crop.key,
            label: growthSiteLabel || `${crop.label} ${new Date().toLocaleDateString()}`,
            gps_lat: gps.lat,
            gps_lon: gps.lon,
          }).select('id').single();
          if (created?.id) {
            autoGrowthSiteId = created.id;
            setGrowthSiteId(created.id);
          }
        }
      }
    } catch (e) { /* ignore */ }

    // Save session
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (me) {
        const distinct = countDistinctSubjects(snapshot.map((f) => f.conf));
        const infected = snapshot.filter((f) => !f.label.toLowerCase().includes('healthy')).length;
        const { data: sess } = await supabase.from('scan_sessions').insert({
          user_id: me.id,
          crop: crop.key,
          mode: 'video',
          frames_analyzed: snapshot.length,
          consensus_label: winnerLabel,
          consensus_conf: winner.confidence,
          vote_count: winner.voteCount,
          vote_total: winner.voteTotal,
          severity_pct: severity,
          duration_sec: Math.round((Date.now() - sessionStart.current) / 1000),
          grid_mode: gridMode,
          quad_results: quadResults,
          plants_count: distinct,
          infected_count: infected,
          gps_lat: gps?.lat ?? null,
          gps_lon: gps?.lon ?? null,
          growth_site_id: autoGrowthSiteId,
          location_label: growthSiteLabel || null,
          previous_label: previousLabel,
        }).select('id').single();
        if (sess?.id) setSessionId(sess.id);
      } else {
        // No user — nothing to do
      }
    } catch (e) {
      // Session save failed — queue for later
      try {
        await enqueueScan({
          id: 'scan-' + Date.now(),
          crop: crop.key,
          consensusLabel: winnerLabel,
          consensusConf: winner.confidence,
          severity,
          framesAnalyzed: snapshot.length,
          voteCount: winner.voteCount,
          voteTotal: winner.voteTotal,
          durationSec: Math.round((Date.now() - sessionStart.current) / 1000),
          gpsLat: gps?.lat ?? null,
          gpsLon: gps?.lon ?? null,
          locationLabel: growthSiteLabel || null,
          createdAt: new Date().toISOString(),
          retries: 0,
        });
        const n = await queueSize();
        setQueueCount(n);
      } catch {}
    }

    // Voice narration
    if (voiceOn) {
      const script = `${winnerLabel}. ${winner.voteCount} of ${winner.voteTotal} frames agree. Confidence ${winner.confidence.toFixed(0)} percent.`;
      try {
        Speech.speak(script, { language: detectLanguage(script), rate: 0.96 });
      } catch {}
    }

    // Deduct 1 scan for the whole session
    try { await refreshScans(); } catch {}

    // Outbreak check — same pest nearby?
    if (gps && !winnerLabel.toLowerCase().includes('healthy')) {
      try {
        const { data } = await supabase.rpc('nearby_outbreaks', {
          p_crop: crop.key,
          p_label: winnerLabel,
          p_lat: gps.lat,
          p_lon: gps.lon,
          p_km: 20,
        });
        if (Array.isArray(data)) setNearby(data);
      } catch {}
    }

    // Fetch advice via Groq
    setAdviceBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const t = session?.access_token;
      if (t) {
        const q = `A GAIA video scan of ${crop.label} in the field concluded: ${winnerLabel} (${winner.confidence.toFixed(1)}% confidence, ${winner.voteCount}/${winner.voteTotal} frames agreed). Give a bold, specific, action plan for a Nigerian farmer.`;
        const r = await fetch(`${API_BASE}/agronomist/text`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
        language: resolveLanguage(question || ''), question: q, history: [] }),
        });
        if (r.ok) {
          const d = await r.json();
          setAdvice(d.answer || null);
          // Update session with advice
          if (sessionId) {
            // best-effort
          }
        }
      }
    } catch (e) { /* ignore */ }
    setAdviceBusy(false);
  };

  const reset = () => {
    setFrames([]);
    setConsensus(null);
    setAdvice(null);
    setError('');
    setSessionId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.kicker}>LIVE FIELD SCAN</Text>
        <Text style={styles.title}>Point at your crops</Text>
      </View>

      {/* Crop selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cropRow}
      >
        {CROPS.map((c) => (
          <Pressable
            key={c.key}
            disabled={scanning}
            onPress={() => { setCrop(c); reset(); }}
            style={[styles.cropChip, crop.key === c.key && styles.cropChipOn]}
          >
            <Text style={[styles.cropText, crop.key === c.key && styles.cropTextOn]}>{c.label}</Text>
            {c.onDeviceKey ? <View style={styles.dotOn} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            enableTorch={flash}
          />
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackText}>Camera permission required</Text>
          </View>
        )}

        {!consensus ? (
          <Animated.View style={[styles.frame, { transform: [{ scale: pulse }] }]} />
        ) : null}

        {/* Live header chips */}
        <View style={styles.topBar}>
          {scanning ? (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>SCANNING</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setFlash((v) => !v)} style={[styles.iconBtn, flash && styles.iconBtnOn]}>
            <Text style={styles.iconText}>{flash ? '⚡' : '💡'}</Text>
          </Pressable>
          <Pressable onPress={() => setVoiceOn((v) => !v)} style={[styles.iconBtn, voiceOn && styles.iconBtnOn]}>
            <Text style={styles.iconText}>{voiceOn ? '🔊' : '🔇'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setGridMode((v) => !v)}
            style={[styles.iconBtn, gridMode && styles.iconBtnOn]}
          >
            <Text style={styles.iconText}>⊞</Text>
          </Pressable>
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.iconBtn}>
            <Text style={styles.iconText}>⚙</Text>
          </Pressable>
        </View>

        {countdown > 0 ? (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Live detections while scanning */}
        {scanning && frames.length > 0 ? (
          <View style={styles.liveBox}>
            <Text style={styles.liveTitle}>FRAMES: {frames.length} / {MAX_FRAMES}</Text>
            {frames.slice(-4).reverse().map((f, i) => (
              <View key={i} style={styles.frameRow}>
                <Text style={styles.frameLabel} numberOfLines={1}>{f.label}</Text>
                <Text style={styles.frameConf}>{f.conf.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Change alarm banner */}
        {changeAlarm ? (
          <View style={styles.alarmBanner}>
            <Text style={styles.alarmIcon}>⚠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alarmTitle}>CHANGE DETECTED</Text>
              <Text style={styles.alarmBody}>
                Field status shifted from {previousLabel || 'healthy'} to {consensus?.label}.
                Inspect immediately.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Consensus result */}
        {consensus ? (
          <View style={[styles.consensusCard, { borderColor: consensus.label.toLowerCase().includes('healthy') ? palette.neon : palette.warning }]}>
            <Text style={styles.consensusKicker}>CONSENSUS RESULT</Text>
            <Text style={styles.consensusLabel}>{consensus.label}</Text>
            <View style={styles.consensusRow}>
              <View style={styles.consensusStat}>
                <Text style={styles.consensusVal}>{consensus.confidence.toFixed(1)}%</Text>
                <Text style={styles.consensusKey}>CONFIDENCE</Text>
              </View>
              <View style={styles.consensusDiv} />
              <View style={styles.consensusStat}>
                <Text style={styles.consensusVal}>{consensus.voteCount}/{consensus.voteTotal}</Text>
                <Text style={styles.consensusKey}>VOTES AGREE</Text>
              </View>
              <View style={styles.consensusDiv} />
              <View style={styles.consensusStat}>
                <Text style={[styles.consensusVal, { color: consensus.severity > 40 ? palette.danger : palette.warning }]}>
                  {consensus.severity}%
                </Text>
                <Text style={styles.consensusKey}>SEVERITY</Text>
              </View>
            </View>

            {/* Sparkline */}
            <View style={styles.sparkWrap}>
              <Sparkline
                values={frames.map((f) => f.conf)}
                width={280}
                height={50}
                color={consensus.label.toLowerCase().includes('healthy') ? palette.neon : palette.warning}
                label="CONFIDENCE OVER TIME"
              />
            </View>
          </View>
        ) : null}

        {/* Quadrant results */}
        {quadResults.length > 0 ? (
          <View style={styles.quadCard}>
            <Text style={styles.quadTitle}>QUADRANT SCAN</Text>
            <View style={styles.quadGrid}>
              {quadResults.map((q: any, i: number) => (
                <View key={i} style={styles.quadCell}>
                  <Text style={styles.quadCorner}>{q.quadrant}</Text>
                  <Text style={styles.quadLabel} numberOfLines={1}>{q.label}</Text>
                  <Text style={styles.quadConf}>{Number(q.confidence || 0).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Nearby outbreaks */}
        {nearby.length > 0 ? (
          <View style={styles.outbreakBox}>
            <Text style={styles.outbreakTitle}>🔔 NEARBY OUTBREAK ALERT</Text>
            <Text style={styles.outbreakBody}>
              {nearby.length} similar {crop.label} case{nearby.length === 1 ? '' : 's'} reported within 20 km in the last 30 days.
            </Text>
            {nearby.slice(0, 3).map((n: any, i: number) => (
              <Text key={i} style={styles.outbreakRow}>
                • {n.km} km away · {new Date(n.at).toLocaleDateString()}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Advice */}
        {adviceBusy ? (
          <View style={styles.adviceLoading}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.adviceLoadingText}>Preparing your action plan…</Text>
          </View>
        ) : null}

        {/* Share buttons (features 24/25) */}
        {consensus ? (
          <View style={styles.shareRow}>
            <Pressable
              onPress={() => shareToWhatsApp({
                crop: crop.key,
                consensusLabel: consensus.label,
                consensusConf: consensus.confidence,
                severity: consensus.severity,
                framesAnalyzed: frames.length,
                gpsLat: gps?.lat, gpsLon: gps?.lon,
                locationLabel: growthSiteLabel,
              })}
              style={[styles.shareBtn, { borderColor: '#25d366' }]}
            >
              <Text style={[styles.shareTxt, { color: '#25d366' }]}>📱 {tr('share_whatsapp', lang)}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShareOpen(true)}
              style={[styles.shareBtn, { borderColor: palette.neon }]}
            >
              <Text style={[styles.shareTxt, { color: palette.neon }]}>✉ {tr('send_sms', lang)}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Hand-off to Voice (feature 26) */}
        {consensus ? (
          <Pressable
            onPress={() => {
              router.push(('/voice?disease=' + encodeURIComponent(consensus.label) +
                '&crop=' + encodeURIComponent(crop.label)) as any);
            }}
            style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7c4dff', marginTop: 8 }]}
          >
            <Text style={[styles.ctaText, { color: '#7c4dff' }]}>🎙 {tr('talk_to_gaia', lang)}</Text>
          </Pressable>
        ) : null}

        {advice ? (
          <View style={styles.adviceBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.adviceTitle}>ACTION PLAN</Text>
              <Pressable onPress={() => setShowAdvice(true)}>
                <Text style={styles.adviceExpand}>EXPAND</Text>
              </Pressable>
            </View>
            <MarkdownOutput content={advice.slice(0, 900) + (advice.length > 900 ? '\n\n…' : '')} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!scanning && !consensus ? (
          <Text style={styles.hint}>
            Choose your crop, then tap Start. GAIA captures frames every {FRAME_INTERVAL_MS / 1000}s, tallies votes, and gives you a consensus verdict + action plan. Uses 1 scan per session.
          </Text>
        ) : null}

        {scanning ? (
          <Pressable onPress={stopScan} style={[styles.cta, { backgroundColor: palette.danger }]}>
            <Text style={styles.ctaText}>STOP & ANALYZE</Text>
          </Pressable>
        ) : consensus ? (
          <>
            <Pressable onPress={() => { reset(); startScan(); }} style={styles.cta}>
              <Text style={styles.ctaText}>SCAN AGAIN</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(('/video-history') as any)}
              style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}
            >
              <Text style={[styles.ctaText, { color: palette.text }]}>VIEW HISTORY</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={startScan} style={styles.cta}>
            <Text style={styles.ctaText}>START SCAN</Text>
          </Pressable>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Settings modal */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setSettingsOpen(false)}>
              <Text style={styles.back}>CLOSE</Text>
            </Pressable>
            <Text style={styles.title}>Scan Settings</Text>

            <Pressable onPress={() => setAutoStopOnHealthy((v) => !v)} style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-stop on healthy</Text>
              <Text style={styles.settingVal}>{autoStopOnHealthy ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable onPress={() => setVoiceOn((v) => !v)} style={styles.settingRow}>
              <Text style={styles.settingLabel}>Voice narration</Text>
              <Text style={styles.settingVal}>{voiceOn ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Max frames per session</Text>
              <Text style={styles.settingVal}>{MAX_FRAMES}</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Frame interval</Text>
              <Text style={styles.settingVal}>{FRAME_INTERVAL_MS / 1000}s</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* SMS modal */}
      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setShareOpen(false)}>
              <Text style={styles.back}>CLOSE</Text>
            </Pressable>
            <Text style={styles.title}>Send by SMS</Text>
            <Text style={styles.sub}>Report will be sent as a text message</Text>
            <TextInput
              value={smsPhone}
              onChangeText={setSmsPhone}
              keyboardType="phone-pad"
              placeholder="08031234567"
              placeholderTextColor={palette.textDim}
              style={[styles.input, { marginTop: 12 }]}
            />
            <Pressable
              onPress={async () => {
                if (!consensus) return;
                const r = await sendSmsReport(smsPhone, {
                  crop: crop.key,
                  consensusLabel: consensus.label,
                  consensusConf: consensus.confidence,
                  severity: consensus.severity,
                  framesAnalyzed: frames.length,
                  gpsLat: gps?.lat, gpsLon: gps?.lon,
                  locationLabel: growthSiteLabel,
                });
                if (r.ok) {
                  setShareOpen(false);
                  Alert.alert('Sent', 'SMS report sent');
                } else {
                  Alert.alert('Failed', r.err || 'Try again');
                }
              }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>SEND SMS</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Full advice modal */}
      <Modal visible={showAdvice} animationType="slide" onRequestClose={() => setShowAdvice(false)}>
        <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
            <Pressable onPress={() => setShowAdvice(false)}>
              <Text style={styles.back}>CLOSE</Text>
            </Pressable>
            <Text style={styles.title}>Action Plan</Text>
            <MarkdownOutput content={advice || ''} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 10 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  cropRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 6 },
  cropChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cropChipOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  cropText: { fontSize: 12, fontWeight: '700', color: p.textDim },
  cropTextOn: { color: p.neon },
  dotOn: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4caf50' },
  cameraWrap: { marginHorizontal: 20, aspectRatio: 3 / 4, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: p.borderHi, position: 'relative' },
  camera: { flex: 1 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: p.textMuted },
  frame: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 2, borderColor: p.neon, borderRadius: 20, opacity: 0.8 },
  topBar: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,60,90,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  iconBtnOn: { backgroundColor: p.neon, borderColor: p.neon },
  iconText: { fontSize: 16 },
  countdownBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  countdownText: { fontSize: 96, fontWeight: '900', color: p.neon, letterSpacing: -4 },
  scroll: { paddingHorizontal: 20, paddingTop: 14 },
  liveBox: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  liveTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginBottom: 8 },
  frameRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  frameLabel: { fontSize: 12, color: p.text, flex: 1, marginRight: 8 },
  frameConf: { fontSize: 12, fontWeight: '800', color: p.neon },
  consensusCard: { padding: 18, borderRadius: 18, backgroundColor: p.surface, borderWidth: 2, marginBottom: 14 },
  consensusKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted },
  consensusLabel: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  consensusRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  consensusStat: { flex: 1, alignItems: 'center' },
  consensusVal: { fontSize: 16, fontWeight: '900', color: p.neon },
  consensusKey: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4 },
  consensusDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  adviceBox: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  adviceTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  adviceExpand: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  adviceLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  adviceLoadingText: { fontSize: 12, color: p.textMuted },
  hint: { fontSize: 13, lineHeight: 20, color: p.textMuted, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
  error: { color: p.danger, textAlign: 'center', marginTop: 12, fontSize: 13 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  shareTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  settingLabel: { fontSize: 14, color: p.text },
  settingVal: { fontSize: 13, fontWeight: '800', color: p.neon },
});