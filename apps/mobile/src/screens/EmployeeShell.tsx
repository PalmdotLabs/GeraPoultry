import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@poultry/api-client';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { Message } from '../components/Message';
import { RoleList } from '../components/RoleList';
import { colors } from '../theme';

type Tab = 'today' | 'account';

interface EmployeeShellProps {
  account: Session;
  verifiedAt: number;
  refreshing: boolean;
  refreshError: string | null;
}

export function EmployeeShell({
  account,
  verifiedAt,
  refreshing,
  refreshError,
}: EmployeeShellProps) {
  const [tab, setTab] = useState<Tab>('today');
  const { refresh, signOut } = useAuth();
  const verificationText = `Live account verification succeeded ${new Date(verifiedAt).toLocaleString()}.`;

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'today' ? (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>FIELDBOOK EMPLOYEE</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Today
              </Text>
              <Text style={styles.greeting}>
                Welcome, {account.user.displayName}.
              </Text>
            </View>
            {refreshError ? (
              <Message tone="error">{refreshError}</Message>
            ) : null}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your employee access</Text>
              <Text style={styles.body}>
                {refreshError
                  ? 'These details were verified earlier. Retry live verification to confirm current roles and permissions.'
                  : verificationText}
              </Text>
              <RoleList roles={account.roles} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                No operational workflows configured
              </Text>
              <Text style={styles.body}>
                Operational workflows have not been configured here yet. There
                are no farm records or employee shortcuts to display.
              </Text>
              <Text style={styles.body}>
                This app does not provide full offline operation. Account access
                must be checked against the live server.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>EMPLOYEE PROFILE</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Account
              </Text>
              <Text style={styles.greeting}>
                Live server identity and role assignments.
              </Text>
            </View>
            {refreshError ? (
              <Message tone="error">{refreshError}</Message>
            ) : null}
            <View style={styles.card}>
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>
                  {account.user.displayName}
                </Text>
              </View>
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>Email address</Text>
                <Text style={styles.detailValue}>
                  {account.user.email ??
                    'No email address is available on this profile.'}
                </Text>
              </View>
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>Roles</Text>
                <RoleList roles={account.roles} />
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Session status</Text>
              <Text style={styles.body}>
                {refreshError
                  ? 'Live verification needs attention. The account information shown is the last verified response, not an offline-authenticated session.'
                  : `${verificationText} This active account does not require administrator access.`}
              </Text>
              <AppButton
                disabled={refreshing}
                label="Refresh account"
                onPress={() => void refresh()}
                pending={refreshing}
                variant="secondary"
              />
              <AppButton
                disabled={refreshing}
                label="Sign out on this device"
                onPress={() => void signOut()}
                variant="danger"
              />
              <Text style={styles.note}>
                Sign-out clears this device only and does not revoke other
                sessions.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <View accessibilityRole="tablist" style={styles.navigation}>
        {(['today', 'account'] as const).map((destination) => {
          const selected = tab === destination;
          const label = destination === 'today' ? 'Today' : 'Account';
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              key={destination}
              onPress={() => setTab(destination)}
              style={[
                styles.navigationItem,
                selected && styles.navigationSelected,
              ]}
            >
              <Text
                style={[
                  styles.navigationLabel,
                  selected && styles.navigationLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 28,
  },
  header: {
    gap: 6,
    paddingTop: 10,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  greeting: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  detail: {
    gap: 6,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  navigation: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navigationItem: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  navigationSelected: {
    backgroundColor: colors.greenWash,
  },
  navigationLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  navigationLabelSelected: {
    color: colors.greenDark,
  },
});
