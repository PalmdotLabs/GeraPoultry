import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface MessageProps {
  children: string;
  tone?: 'error' | 'info' | 'success';
}

export function Message({ children, tone = 'info' }: MessageProps) {
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.container, styles[tone]]}
    >
      <Text style={[styles.text, tone === 'error' && styles.errorText]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 13,
  },
  info: {
    backgroundColor: colors.greenWash,
  },
  success: {
    backgroundColor: colors.greenWash,
  },
  error: {
    backgroundColor: colors.dangerWash,
  },
  text: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: colors.danger,
  },
});
