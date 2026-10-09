import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string; peer?: string; name?: string; mode?: string; signal?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const roomId = params.room as string | undefined;
  const peerId = params.peer as string | undefined;
  const peerName = (params.name as string) || 'Caller';
  const mode = (params.mode as string) || 'voice';
  const signalId = params.signal as string | undefined;
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTimer = () => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return (m < 10 ? '0' + m : String(m)) + ':' + (s < 10 ? '0' + s : String(s));
  };

  const hangup = async () => {
    try {
      if (signalId) {
        await supabase.from('chat_call_signals').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', signalId);
      } else if (roomId && user) {
        await supabase.from('chat_call_signals').update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('room_id', roomId).eq('caller_id', user.id).eq('status', 'ringing');
      }
    } catch {}
    router.back();
  };

  const jitsiUrl = (() => {
    if (!roomId) return '';
    const displayName = encodeURIComponent(user?.email?.split('@')[0] || 'GAIA user');
    const muteVideo = mode === 'voice' ? 'true' : 'false';
    return 'https://meet.jit.si/gaia-' + roomId + '#config.prejoinPageEnabled=false&config.startWithVideoMuted=' + muteVideo + '&userInfo.displayName=' + displayName + '&config.startWithAudioMuted=false';
  })();

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.infoWrap}>
          <Text style={styles.peerName} numberOfLines={1}>{peerName}</Text>
          <Text style={styles.timer}>{mode === 'voice' ? 'VOICE CALL' : 'VIDEO CALL'}  ·  {fmtTimer()}</Text>
        </View>
        <Pressable onPress={hangup} style={styles.hangupBtn}>
          <Text style={styles.hangupTxt}>END</Text>
        </Pressable>
      </View>
      <WebView
        source={{ uri: jitsiUrl }}
        style={styles.web}
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsFullscreenVideo
      />
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, backgroundColor: '#0b141a', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  infoWrap: { flex: 1 },
  peerName: { fontSize: 17, fontWeight: '900', color: '#fff' },
  timer: { fontSize: 11, color: '#8696a0', marginTop: 3, letterSpacing: 1 },
  hangupBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#ff3b5c' },
  hangupTxt: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  web: { flex: 1, backgroundColor: '#000' },
});
