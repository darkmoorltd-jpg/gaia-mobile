
import Markdown from 'react-native-markdown-display';
import { View, StyleSheet } from 'react-native';
import { palette, spacing } from '../theme';

export function MarkdownOutput({ content }: { content: string }) {
  return (
    <View style={styles.wrap}>
      <Markdown style={mdStyles}>{content}</Markdown>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
});

const mdStyles: any = {
  body: { color: palette.text, fontSize: 15, lineHeight: 23 },
  heading1: { color: palette.neon, fontSize: 22, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  heading2: { color: palette.neon, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  heading3: { color: palette.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 8 },
  bullet_list: { marginVertical: 6 },
  ordered_list: { marginVertical: 6 },
  list_item: { marginVertical: 3 },
  strong: { color: palette.neon, fontWeight: '800' },
  em: { fontStyle: 'italic', color: palette.textMuted },
  code_inline: {
    backgroundColor: 'rgba(0,255,136,0.12)',
    color: palette.neon,
    paddingHorizontal: 4,
    borderRadius: 3,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: palette.text,
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  table: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    marginVertical: 10,
  },
  thead: { backgroundColor: 'rgba(0,255,136,0.08)' },
  th: { padding: 8, color: palette.neon, fontWeight: '800', fontSize: 13 },
  td: {
    padding: 8,
    color: palette.text,
    borderTopWidth: 1,
    borderColor: palette.border,
    fontSize: 13,
  },
  tr: { borderColor: palette.border },
  blockquote: {
    backgroundColor: 'rgba(0,255,136,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: palette.neon,
    paddingLeft: 10,
    marginVertical: 8,
    paddingVertical: 6,
  },
  link: { color: palette.neon, textDecorationLine: 'underline' },
  hr: { backgroundColor: palette.border, height: 1, marginVertical: 12 },
};
