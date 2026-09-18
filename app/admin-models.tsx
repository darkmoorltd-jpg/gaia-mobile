import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import axios from 'axios';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API = 'https://gaia-api-xuly.onrender.com';

export default function AdminModels() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [models, setModels] = useState<string[]>([]);
  const [healthy, setHealthy] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const h = await axios.get(API + '/health', { timeout: 60000 });
        setHealthy(!!h.data.ok);
        setLoaded(h.data.models_loaded || []);
        const m = await axios.get(API + '/models', { timeout: 60000 });
        setModels(m.data.models || []);
      } catch {}
      setBusy(false);
    })();
  }, []);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Model Health</Text>
        <View style={[styles.status, { backgroundColor: healthy ? 'rgba(0,200,100,0.15)' : 'rgba(255,60,90,0.15)' }]}>
          <Text style={[styles.statusText, { color: healthy ? palette.neon : palette.danger }]}>
            API {healthy ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        {busy ? <Text style={styles.loading}>Checking models...</Text> : null}
        <Text style={styles.sub}>{models.length} models available</Text>
        {models.map((m) => (
          <View key={m} style={styles.card}>
            <Text style={styles.modelName}>{m}</Text>
            <Text style={styles.modelStatus}>
              {loaded.includes(m) ? 'LOADED' : 'READY (loads on first call)'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, marginBottom: 12 },
  status: { padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  statusText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  loading: { fontSize: 13, color: p.textMuted, paddingVertical: 12 },
  sub: { fontSize: 13, color: p.textMuted, marginBottom: 16 },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  modelName: { fontSize: 14, fontWeight: '800', color: p.text },
  modelStatus: { fontSize: 11, color: p.neon, marginTop: 4, letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
