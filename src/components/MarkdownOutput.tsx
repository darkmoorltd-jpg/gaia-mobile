import React from 'react';
import { View, Platform, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface Props {
  content: string;
  compact?: boolean;
}

// ============================================================
// High contrast — hardcoded light text so it's readable on
// any dark card regardless of theme mode (light/dark).
// Do NOT use palette.text here — it's #0a1a12 in light mode.
// ============================================================
export function MarkdownOutput({ content, compact }: Props) {
  const TEXT      = '#e5e7eb';
  const TEXT_HI   = '#ffffff';
  const TEXT_MUTE = '#9ca3af';
  const ACCENT    = '#00ff88';
  const BORDER    = 'rgba(255,255,255,0.15)';
  const BG_CODE   = 'rgba(0,0,0,0.65)';
  const BG_QUOTE  = 'rgba(0,255,136,0.10)';

  const md = {
    body: { color: TEXT, fontSize: compact ? 13 : 14.5, lineHeight: compact ? 20 : 23 },
    heading1: { color: TEXT_HI, fontSize: compact ? 17 : 21, fontWeight: '900', marginTop: 12, marginBottom: 8, lineHeight: compact ? 22 : 26 },
    heading2: { color: TEXT_HI, fontSize: compact ? 15 : 17, fontWeight: '800', marginTop: 14, marginBottom: 6, lineHeight: compact ? 20 : 23 },
    heading3: { color: TEXT_HI, fontSize: compact ? 13.5 : 15, fontWeight: '700', marginTop: 10, marginBottom: 4 },
    heading4: { color: TEXT_HI, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '800', color: TEXT_HI },
    em:     { fontStyle: 'italic', color: TEXT_MUTE },
    link:   { color: ACCENT, textDecorationLine: 'underline' },
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
    th: { padding: 8, backgroundColor: 'rgba(0,255,136,0.15)', flex: 1, fontWeight: '800', color: TEXT_HI, fontSize: 12 },
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
