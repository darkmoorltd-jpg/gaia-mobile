import React from 'react';
import { View, Platform, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../theme';

interface Props {
  content: string;
  compact?: boolean;
}

// ============================================================
// Theme-aware markdown:
//   light mode → dark text on light bg  (palette.text = #0a1a12)
//   dark mode  → light text on dark bg  (palette.text = #ffffff)
// ============================================================
export function MarkdownOutput({ content, compact }: Props) {
  const { palette } = useTheme();

  const TEXT      = palette.text;          // flips with theme
  const TEXT_HI   = palette.text;          // headings same
  const TEXT_MUTE = palette.textMuted;
  const ACCENT    = palette.neon;
  const BORDER    = palette.border;
  const BG_CODE   = 'rgba(128,128,128,0.15)';  // works on both bgs
  const BG_QUOTE  = palette.neonSoft;           // theme-aware
  const BG_TABLE_HEADER = palette.neonSoft;
  const ON_ACCENT = palette.obsidian;           // for text on neon bg

  const md = {
    body: { color: TEXT, fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 23 },
    heading1: { color: TEXT_HI, fontSize: compact ? 17 : 21, fontWeight: '900', marginTop: 12, marginBottom: 8, lineHeight: compact ? 22 : 26 },
    heading2: { color: TEXT_HI, fontSize: compact ? 15 : 17, fontWeight: '800', marginTop: 14, marginBottom: 6, lineHeight: compact ? 20 : 23 },
    heading3: { color: TEXT_HI, fontSize: compact ? 13.5 : 15, fontWeight: '700', marginTop: 10, marginBottom: 4 },
    heading4: { color: TEXT_HI, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '800', color: TEXT_HI },
    em: { fontStyle: 'italic', color: TEXT_MUTE },
    link: { color: ACCENT, textDecorationLine: 'underline' },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    list_item: { marginBottom: 6, flexDirection: 'row' },
    bullet_list_icon: { color: ACCENT, fontSize: 14, fontWeight: '900', marginRight: 8, marginLeft: 0, lineHeight: 22 },
    bullet_list_content: { flex: 1, color: TEXT, fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 22 },
    ordered_list_icon: { color: ACCENT, fontSize: 13, fontWeight: '900', marginRight: 8, lineHeight: 22 },
    ordered_list_content: { flex: 1, color: TEXT, fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 22 },
    blockquote: { backgroundColor: BG_QUOTE, borderLeftWidth: 3, borderLeftColor: ACCENT, paddingLeft: 12, paddingRight: 10, paddingVertical: 10, marginVertical: 8, borderRadius: 6 },
    code_inline: { backgroundColor: BG_CODE, color: ACCENT, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: compact ? 12 : 13, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    code_block: { backgroundColor: BG_CODE, color: TEXT, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: compact ? 12 : 13, padding: 12, borderRadius: 8, marginVertical: 8 },
    fence: { backgroundColor: BG_CODE, color: TEXT, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: compact ? 12 : 13, padding: 12, borderRadius: 8, marginVertical: 8 },
    hr: { backgroundColor: BORDER, height: 1, marginVertical: 14 },
    table: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, overflow: 'hidden', marginVertical: 10 },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
    th: { padding: 8, backgroundColor: BG_TABLE_HEADER, flex: 1, fontWeight: '800', color: TEXT_HI, fontSize: 12 },
    td: { padding: 8, flex: 1, color: TEXT, fontSize: 12 },
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
