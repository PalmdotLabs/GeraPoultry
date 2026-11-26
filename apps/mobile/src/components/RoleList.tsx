import { StyleSheet, Text, View } from 'react-native';
import type { RoleSummary } from '@poultry/validation';
import { colors } from '../theme';

export function RoleList({ roles }: { roles: RoleSummary[] }) {
  if (roles.length === 0) {
    return (
      <Text style={styles.empty}>
        No roles assigned. Your active employee account remains available;
        contact an administrator about role access.
      </Text>
    );
  }

  return (
    <View accessibilityLabel="Assigned roles" style={styles.list}>
      {roles.map((role) => (
        <View key={role.code} style={styles.chip}>
          <Text style={styles.role}>{role.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.greenWash,
    borderRadius: 18,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  role: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
});
