import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

interface StatusScreenProps {
  title: string;
  description: string;
  loading?: boolean;
  children?: ReactNode;
}

export function StatusScreen({
  title,
  description,
  loading,
  children,
}: StatusScreenProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading"
            color={colors.green}
            size="large"
          />
        ) : null}
        <Text style={styles.eyebrow}>FIELDBOOK EMPLOYEE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        {children ? <View style={styles.actions}>{children}</View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.canvas,
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    padding: 24,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 35,
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
});
