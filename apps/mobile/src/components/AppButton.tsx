import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function AppButton({
  label,
  onPress,
  pending = false,
  disabled = false,
  variant = 'primary',
}: AppButtonProps) {
  const unavailable = pending || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: pending, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        unavailable && styles.disabled,
        pressed && !unavailable && styles.pressed,
      ]}
    >
      {pending ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.greenDark}
        />
      ) : (
        <Text
          style={[styles.label, variant === 'primary' && styles.primaryLabel]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primary: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.dangerWash,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: colors.white,
  },
});
