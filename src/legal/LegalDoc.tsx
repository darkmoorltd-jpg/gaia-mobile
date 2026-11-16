import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import type { LegalDoc as Doc } from './content';

export default function LegalDoc({ doc }: { doc: Doc }) {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const blocks = useMemo(() => parse(doc.body), [doc.body]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.meta}>Version {doc.version} · Updated {doc.updated}</Text>
        {blocks.map((b, i) => renderBlock(b, i, styles, palette))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'hr' }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function parse(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^# /.test(line)) { out.push({ type: 'h1', text: line.replace(/^# /, '') }); i++; continue; }
    if (/^## /.test(line)) { out.push({ type: 'h2', text: line.replace(/^## /, '') }); i++; continue; }
    if (/^### /.test(line)) { out.push({ type: 'h3', text: line.replace(/^### /, '') }); i++; continue; }
    if (/^---\s*$/.test(line)) { out.push({ type: 'hr' }); i++; continue; }
    if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*] /, ''));
        i++;
      }
      out.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\. /, ''));
        i++;
      }
      out.push({ type: 'ol', items });
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|---|[-*] |\d+\. )/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push({ type: 'p', text: para.join(' ') });
  }
  return out;
}

function renderInline(text: string, style: any, linkStyle: any, onLink: (url: string) => void) {
  // split into bold / italic / link / plain
  const parts: { type: string; text: string; url?: string }[] = [];
  let rest = text;
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m) { parts.push({ type: 'text', text: rest }); break; }
    if (m.index! > 0) parts.push({ type: 'text', text: rest.slice(0, m.index) });
    if (m[0].startsWith('**')) parts.push({ type: 'bold', text: m[0].slice(2, -2) });
    else if (m[0].startsWith('*')) parts.push({ type: 'italic', text: m[0].slice(1, -1) });
    else if (m[2] && m[3]) parts.push({ type: 'link', text: m[2], url: m[3] });
    rest = rest.slice(m.index! + m[0].length);
  }
  return parts.map((p, i) => {
    if (p.type === 'bold') return <Text key={i} style={[style, { fontWeight: '900' }]}>{p.text}</Text>;
    if (p.type === 'italic') return <Text key={i} style={[style, { fontStyle: 'italic' }]}>{p.text}</Text>;
    if (p.type === 'link') return (
      <Text key={i} style={[style, linkStyle]} onPress={() => p.url && onLink(p.url)}>
        {p.text}
      </Text>
    );
    return <Text key={i} style={style}>{p.text}</Text>;
  });
}

function renderBlock(b: Block, i: number, s: any, p: any) {
  const onLink = (url: string) => Linking.openURL(url);
  if (b.type === 'h1') return <Text key={i} style={s.h1}>{b.text}</Text>;
  if (b.type === 'h2') return <Text key={i} style={s.h2}>{b.text}</Text>;
  if (b.type === 'h3') return <Text key={i} style={s.h3}>{b.text}</Text>;
  if (b.type === 'hr') return <View key={i} style={s.hr} />;
  if (b.type === 'p') return <Text key={i} style={s.p}>{renderInline(b.text, s.pInline, s.link, onLink)}</Text>;
  if (b.type === 'ul') return (
    <View key={i} style={s.list}>
      {b.items.map((it, j) => (
        <View key={j} style={s.listRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.listItem}>{renderInline(it, s.pInline, s.link, onLink)}</Text>
        </View>
      ))}
    </View>
  );
  if (b.type === 'ol') return (
    <View key={i} style={s.list}>
      {b.items.map((it, j) => (
        <View key={j} style={s.listRow}>
          <Text style={s.bullet}>{j + 1}.</Text>
          <Text style={s.listItem}>{renderInline(it, s.pInline, s.link, onLink)}</Text>
        </View>
      ))}
    </View>
  );
  return null;
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '900', color: p.text, marginBottom: 6 },
  meta: { fontSize: 11, color: p.textMuted, marginBottom: 24 },
  h1: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 24, marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '900', color: p.neon, marginTop: 24, marginBottom: 8, letterSpacing: 0.5 },
  h3: { fontSize: 14, fontWeight: '800', color: p.text, marginTop: 16, marginBottom: 6 },
  hr: { height: 1, backgroundColor: p.border, marginVertical: 20 },
  p: { fontSize: 13, color: p.text, lineHeight: 21, marginBottom: 10 },
  pInline: { fontSize: 13, color: p.text, lineHeight: 21 },
  link: { color: p.neon, textDecorationLine: 'underline' },
  list: { marginBottom: 12 },
  listRow: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 13, color: p.neon, fontWeight: '900', width: 18, lineHeight: 21 },
  listItem: { flex: 1, fontSize: 13, color: p.text, lineHeight: 21 },
});
