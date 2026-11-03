import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { challenge, namePrompt } from '@/copy/strings';

import { FONTS, Txt } from './Txt';
import { useTheme } from './ThemeContext';

interface NamePromptProps {
  visible: boolean;
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/** Asks once for the name shown on challenge links ("<name> ne challenge kiya!"). */
export function NamePrompt({ visible, initial, onSubmit, onCancel }: NamePromptProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial);
  const trimmed = name.trim().slice(0, 24);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Txt size={18} weight={800} lh={1.2} color={colors.text}>
            {namePrompt.title}
          </Txt>
          <Txt size={13} lh={1.3} color={colors.muted}>
            {namePrompt.help(challenge.from(trimmed || namePrompt.placeholder))}
          </Txt>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={namePrompt.placeholder}
            placeholderTextColor={colors.muted}
            autoFocus
            maxLength={24}
            returnKeyType="send"
            onSubmitEditing={() => trimmed && onSubmit(trimmed)}
            accessibilityLabel={namePrompt.title}
            style={[styles.input, { color: colors.bg, backgroundColor: colors.text, fontFamily: FONTS[700] }]}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={styles.action}>
              <Txt size={15} weight={700} lh={1.2} color={colors.text}>
                {namePrompt.cancel}
              </Txt>
            </Pressable>
            <Pressable
              onPress={() => trimmed && onSubmit(trimmed)}
              disabled={!trimmed}
              accessibilityRole="button"
              style={[styles.action, styles.primary, { backgroundColor: colors.primary.bg, opacity: trimmed ? 1 : 0.5 }]}
            >
              <Txt size={15} weight={800} lh={1.2} color={colors.primary.text}>
                {namePrompt.share}
              </Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  input: { height: 46, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  action: { height: 42, paddingHorizontal: 16, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  primary: { minWidth: 96 },
});
