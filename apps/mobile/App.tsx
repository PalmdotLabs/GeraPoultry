import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { AuthProvider } from './src/auth/AuthProvider';
import { AuthGate } from './src/screens/AuthGate';
import { colors } from './src/theme';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
});
