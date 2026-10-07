import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const JITSI_DOMAIN = 'meet.jit.si';

export default function MeetRoom() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string }>();
  const roomId = params.room;
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId || !user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('meet_join_meeting', { p_room: roomId });
      if (error) { setError(error.message); setBusy(false); return; }
      if (!data?.ok) { setError(data?.error || 'Meeting not found'); setBusy(false); return; }
      setMeeting(data);
      const p = await supabase.rpc('meet_participants', { p_meeting_id: data.id });
      setParticipants(p.data || []);
    } catch (e: any) {
      setError(e?.message || 'Could not join meeting');
    }
    setBusy(false);
  }, [roomId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!meeting?.id) return;
    const t = setInterval(async () => {
      const p = await supabase.rpc('meet_participants', { p_meeting_id: meeting.id });
      setParticipants(p.data || []);
    }, 8000);
    return () => clearInterval(t);
  }, [meeting?.id]);

  const displayName = user?.email?.split('@')[0] || 'GAIA Farmer';

  const endMeeting = () => {
    Alert.alert('End meeting?', 'The call ends for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          if (meeting?.id) {
            await supabase.rpc('meet_end_meeting', { p_id: meeting.id });
          }
          router.back();
        },
      },
    ]);
  };

  const shareLink = async () => {
    if (!roomId) return;
    await Share.share({ message: 'Join my GAIA meeting: https://' + JITSI_DOMAIN + '/' + roomId });
  };

  const jitsiUrl =
    'https://' + JITSI_DOMAIN + '/' + encodeURIComponent(roomId || '') +
    '#userInfo.displayName=%22' + encodeURIComponent(displayName) + '%22' +
    '&config.startWithAudioMuted=true' +
    '&config.startWithVideoMuted=false' +
    '&config.prejoinPageEnabled=false' +
    '&config.disableDeepLinking=true' +
    '&config.p2p.enabled=true' +
    '&interfaceConfig.SHOW_JITSI_WATERMARK=false' +
    '&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false' +
    '&interfaceConfig.TOOLBAR_BUTTONS=%5B%22microphone%22%2C%22camera%22%2C%22chat%22%2C%22raisehand%22%2C%22tileview%22%2C%22fullscreen%22%2C%22settings%22%2C%22hangup%22%5D';

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Could not join</Text>
        <Text style={styles.errText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>BACK</Text>
        </Pressable>
      </View>
    );
  }

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.neon} size="large" />
        <Text style={styles.loadingText}>Joining meeting…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{meeting?.title || 'Meeting'}</Text>
          <Text style={styles.sub}>{participants.length} participant{participants.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={shareLink} style={styles.iconBtn}>
          <Text style={styles.iconText}>↗</Text>
        </Pressable>
        {meeting?.is_host ? (
          <Pressable onPress={endMeeting} style={styles.iconBtn}>
            <Text style={[styles.iconText, { color: '#ff3b5c' }]}>X</Text>
          </Pressable>
        ) : null}
      </View>

      <WebView
        source={{ uri: jitsiUrl }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        onPermissionRequest={(event: any) => {
          try { event?.request?.grant?.(event?.request?.resources || []); } catch {}
        }}
        onError={(e) => { console.log('webview error', e.nativeEvent); }}
        onHttpError={(e) => { console.log('webview http error', e.nativeEvent); }}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
      />

      <View style={styles.peopleBar}>
        {participants.slice(0, 6).map((p, i) => (
          <View key={i} style={styles.avatar}>
            <Text style={styles.avatarText}>{(p.name || p.email || '?').charAt(0).toUpperCase()}</Text>
          </View>
        ))}
        {participants.length > 6 ? (
          <View style={styles.avatar}><Text style={styles.avatarText}>+{participants.length - 6}</Text></View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { fontSize: 13, color: p.textMuted, marginTop: 14 },
  errTitle: { fontSize: 18, fontWeight: '900', color: '#ff3b5c', marginBottom: 8 },
  errText: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginBottom: 24 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.neon },
  backBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 50, paddingBottom: 12, backgroundColor: '#0a0e0c' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconText: { fontSize: 22, fontWeight: '900', color: '#00ff88', lineHeight: 24 },
  title: { fontSize: 14, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  web: { flex: 1, backgroundColor: '#000' },
  peopleBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0a0e0c', gap: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: '#00ff88', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '900', color: '#00ff88' },
});
