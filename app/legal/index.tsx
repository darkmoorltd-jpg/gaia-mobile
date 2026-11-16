import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { ALL_DOCS } from '../../src/legal/content';

export default function LegalIndex() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Legal</Text>
        <Text style={styles.meta}>Last updated 16 November 2026</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {ALL_DOCS.map(doc => (
          <Pressable
            key={doc.slug}
            onPress={() => router.push(`/legal/${doc.slug}` as any)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{doc.title}</Text>
            <Text style={styles.cardMeta}>Version {doc.version} · {doc.updated}</Text>
            <Text style={styles.cardChevron}>›</Text>
          </Pressable>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: p.border, marginBottom: 10, position: 'relative' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text, paddingRight: 20 },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  cardChevron: { position: 'absolute', right: 16, top: 16, fontSize: 24, color: p.textMuted },
});
