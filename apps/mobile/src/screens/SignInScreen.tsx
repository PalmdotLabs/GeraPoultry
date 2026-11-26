import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { Message } from '../components/Message';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthProvider';

export function SignInScreen({ message }: { message: string | null }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setEmailError(validEmail ? null : 'Enter a valid email address.');
    setPasswordError(password ? null : 'Enter your password.');
    setError(null);
    if (!validEmail || !password) return;

    setPending(true);
    try {
      const result = await signIn(email, password);
      if (result) setError(result);
    } catch {
      setError('Sign-in could not be completed. Try again.');
    } finally {
      setPassword('');
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>FIELDBOOK EMPLOYEE</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Welcome back
          </Text>
          <Text style={styles.subtitle}>
            Sign in with your hosted employee account.
          </Text>
        </View>
        <View style={styles.form}>
          {message ? <Message>{message}</Message> : null}
          {error ? <Message tone="error">{error}</Message> : null}
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!pending}
            error={emailError}
            keyboardType="email-address"
            label="Email address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            returnKeyType="next"
            testID="email"
            textContentType="emailAddress"
            value={email}
          />
          <View style={styles.passwordField}>
            <FormField
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              editable={!pending}
              error={passwordError}
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              returnKeyType="done"
              secureTextEntry={!passwordVisible}
              testID="password"
              textContentType="password"
              value={password}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                passwordVisible ? 'Hide password' : 'Show password'
              }
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => setPasswordVisible((visible) => !visible)}
              style={styles.passwordToggle}
            >
              <Text style={styles.toggleText}>
                {passwordVisible ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
          <AppButton
            disabled={pending}
            label="Sign in"
            onPress={() => void submit()}
            pending={pending}
          />
          <Text style={styles.privacy}>
            Credentials are sent only to the configured Supabase Auth service.
            Passwords are never saved on this device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  container: {
    flexGrow: 1,
    gap: 28,
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    gap: 10,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 18,
    padding: 20,
  },
  passwordField: {
    position: 'relative',
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 64,
    position: 'absolute',
    right: 1,
    top: 27,
  },
  toggleText: {
    color: colors.greenDark,
    fontSize: 15,
    fontWeight: '700',
  },
  privacy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
