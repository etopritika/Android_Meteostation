import { Pressable, StyleSheet, Text } from 'react-native';

import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        style={[
          styles.label,
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          disabled && styles.disabledLabel,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: tokens.space.control,
  },
  primary: {
    backgroundColor: palette.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  disabled: {
    backgroundColor: palette.disabledFill,
    borderWidth: 0,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  primaryLabel: {
    color: palette.onAccent,
  },
  secondaryLabel: {
    color: palette.accent,
  },
  disabledLabel: {
    color: palette.disabledText,
  },
});
