/**
 * Feedback that sits outside the scene: an inline `Notice` (the saving-off banner, the
 * recovery notice, the game's NOT SAVED strip), a `NoticeSheet` bottom sheet (New run and
 * the replaced-word notice) and the `ChoiceButton` they and the picker cards share.
 * Designs: design/screens/Resume-*.png (#57).
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { a11y } from '@/copy/strings';
import { Icon, type IconName } from '@/themes/icons';
import type { Theme } from '@/themes/types';

import { MAX_WIDTH } from './Screen';
import { ThemeProvider, useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface NoticeProps {
  icon: IconName;
  title: string;
  /** Shown under the title (banner) or after it on the same line (strip). */
  body: string;
  /** A banner is a bordered card with a title line; a strip is one dashed line for the game screen. */
  variant?: 'banner' | 'strip';
  /** Adds a 44x44 dismiss button (banner only). */
  onDismiss?: () => void;
  /** Tighter padding on compact screens. */
  compact?: boolean;
  testID?: string;
}

export function Notice({ icon, title, body, variant = 'banner', onDismiss, compact, testID }: NoticeProps) {
  const { colors } = useTheme();
  if (variant === 'strip') {
    return (
      <View
        role="status"
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={`${title} ${body}`}
        testID={testID}
        style={[styles.strip, { borderColor: colors.accent, backgroundColor: colors.panel }]}
      >
        <Icon name={icon} size={18} color={colors.accent} strokeWidth={2.2} />
        <Txt size={13} lh={1.25} color={colors.muted} style={styles.flex}>
          <Txt size={13} weight={800} lh={1.25} color={colors.text}>
            {title}
          </Txt>{' '}
          {body}
        </Txt>
      </View>
    );
  }
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[
        styles.banner,
        { borderColor: colors.accent, backgroundColor: colors.panel, paddingVertical: compact ? 8 : 10, paddingRight: onDismiss ? 6 : 12 },
      ]}
    >
      <View style={styles.bannerIcon}>
        <Icon name={icon} size={22} color={colors.accent} strokeWidth={2.2} />
      </View>
      <View style={[styles.flex, styles.bannerText]}>
        <Txt size={14} weight={800} lh={1.25} color={colors.text}>
          {title}
        </Txt>
        <Txt size={13} lh={1.3} color={colors.muted}>
          {body}
        </Txt>
      </View>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={a11y.dismiss}
          testID={testID ? `${testID}-dismiss` : undefined}
          style={styles.dismiss}
        >
          <Icon name="close" size={18} color={colors.text} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

interface NoticeSheetProps {
  theme: Theme;
  visible: boolean;
  /** Android back and the escape key. Callers decide what leaving without a choice means. */
  onRequestClose: () => void;
  title: string;
  icon?: IconName;
  children: ReactNode;
  testID?: string;
}

/**
 * A bottom sheet in a native `Modal`: the scrim dims the screen behind it and the platform's
 * slide animation runs off the JS thread. The title is the dialog's header.
 */
export function NoticeSheet({ theme, visible, onRequestClose, title, icon, children, testID }: NoticeSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onRequestClose}>
      <ThemeProvider value={theme}>
        <View style={styles.scrim}>
          <View
            accessibilityViewIsModal
            testID={testID}
            style={[
              styles.sheet,
              { backgroundColor: colors.panel, borderTopColor: colors.accent, paddingBottom: 20 + insets.bottom },
            ]}
          >
            <View style={styles.sheetTitle}>
              {icon && <Icon name={icon} size={26} color={colors.accent} strokeWidth={2.2} />}
              <Txt display size={24} lh={1.2} color={colors.text} accessibilityRole="header" style={styles.flex}>
                {title}
              </Txt>
            </View>
            {children}
          </View>
        </View>
      </ThemeProvider>
    </Modal>
  );
}

/** One line of a sheet's body, with the accent bullet. */
export function SheetLine({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.line}>
      <Txt size={15} weight={800} lh={1.35} color={colors.accent}>
        •
      </Txt>
      <Txt size={15} lh={1.35} color={colors.text} style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

interface ChoiceButtonProps {
  label: string;
  onPress: () => void;
  /** Filled with the primary colours, or outlined in the accent. */
  variant: 'primary' | 'outline';
  height?: number;
  icon?: IconName;
  /** Draws the icon filled (the play triangle). */
  iconFilled?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** The 12px-radius action button from the Resume mockups. A local control so every height matches. */
export function ChoiceButton({ label, onPress, variant, height = 48, icon, iconFilled, accessibilityLabel, disabled, testID, style }: ChoiceButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const ink = primary ? colors.primary.text : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.choice,
        { height },
        primary ? { backgroundColor: colors.primary.bg } : { borderColor: colors.accent, borderWidth: 1.5 },
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={ink} strokeWidth={1.5} filled={iconFilled} />}
      <Txt size={16} weight={800} lh={1.2} color={ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingLeft: 12, borderRadius: 14, borderWidth: 1.5 },
  bannerIcon: { marginTop: 1 },
  bannerText: { gap: 2 },
  dismiss: { width: 44, height: 44, marginVertical: -6, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingTop: 18,
    paddingHorizontal: 16,
    gap: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1.5,
  },
  sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flexDirection: 'row', gap: 8 },
  choice: { borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
