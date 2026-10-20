import React from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../theme';

interface Props {
  content: string;
  compact?: boolean;
}

export function MarkdownOutput({ content, compact }: Props) {
  const { palette } = useTheme();

  const md = {
    body: {
      color: palette.text || '#e5e7eb',
      fontSize: compact ? 13 : 14.5,
      lineHeight: compact ? 20 : 23,
    },
    heading1: {
      color: palette.text || '#fff',
      fontSize: compact ? 17 : 21,
      fontWeight: '900' as const,
      marginTop: 12, marginBottom: 8, lineHeight: compact ? 22 : 26,
    },
    heading2: {
      color: palette.text || '#fff',
      fontSize: compact ? 15 : 17,
      fontWeight: '800' as const,
      marginTop: 14, marginBottom: 6, lineHeight: compact ? 20 : 23,
    },
    heading3: {
      color: palette.text || '#fff',
      fontSize: compact ? 13.5 : 15,
      fontWeight: '700' as const,
      marginTop: 10, marginBottom: 4,
    },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '800' as const, color: palette.text || '#fff' },
    em: { fontStyle: 'italic' as const, color: palette.textMuted || '#d1d5db' },
    link: { color: palette.neon || '#00ff88', textDecorationLine: 'underline' as const },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    list_item: { marginBottom: 6, flexDirection: 'row' as const },
    bullet_list_icon: {
      color: palette.neon || '#00ff88', fontSize: 14, fontWeight: '900' as const,
      marginRight: 8, marginLeft: 0, lineHeight: 22,
    },
    bullet_list_content: {
      flex: 1, color: palette.text || '#e5e7eb',
      fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 22,
    },
    ordered_list_icon: {
      color: palette.neon || '#00ff88', fontSize: 13, fontWeight: '900' as const,
      marginRight: 8, lineHeight: 22,
    },
    ordered_list_content: {
      flex: 1, color: palette.text || '#e5e7eb',
      fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 22,
    },
    blockquote: {
      backgroundColor: 'rgba(0,255,136,0.06)',
      borderLeftWidth: 3, borderLeftColor: palette.neon || '#00ff88',
      paddingLeft: 12, paddingRight: 10, paddingVertical: 10,
      marginVertical: 8, borderRadius: 6,
    },
    code_inline: {
      backgroundColor: 'rgba(255,255,255,0.10)', color: palette.neon || '#00ff88',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: compact ? 12 : 13, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    },
    code_block: {
      backgroundColor: 'rgba(0,0,0,0.35)', color: palette.text || '#e5e7eb',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: compact ? 12 : 13, padding: 12, borderRadius: 8, marginVertical: 8,
    },
    fence: {
      backgroundColor: 'rgba(0,0,0,0.35)', color: palette.text || '#e5e7eb',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: compact ? 12 : 13, padding: 12, borderRadius: 8, marginVertical: 8,
    },
    hr: { backgroundColor: palette.border || 'rgba(255,255,255,0.1)', height: 1, marginVertical: 14 },
    table: {
      borderWidth: 1, borderColor: palette.border || 'rgba(255,255,255,0.1)',
      borderRadius: 8, overflow: 'hidden' as const, marginVertical: 10,
    },
    tr: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1, borderBottomColor: palette.border || 'rgba(255,255,255,0.08)',
    },
    th: {
      padding: 8, backgroundColor: 'rgba(0,255,136,0.08)',
      flex: 1, fontWeight: '800' as const, color: palette.text || '#fff', fontSize: 12,
    },
    td: { padding: 8, flex: 1, color: palette.text || '#e5e7eb', fontSize: 12 },
  };

  return (
    <View style={{ flex: 1, width: '100%' }}>
      <Markdown
        style={md as any}
        onLinkPress={(url) => {
          try { Linking.openURL(url); } catch {}
          return false;
        }}
      >
        {content || ''}
      </Markdown>
    </View>
  );
}

export default MarkdownOutput;
