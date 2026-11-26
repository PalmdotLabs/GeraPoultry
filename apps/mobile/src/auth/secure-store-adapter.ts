import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { createSecureSessionStorage } from './secure-session-storage';

export const secureStoreAuthStorage = createSecureSessionStorage({
  getItemAsync: (key) => getItemAsync(key),
  setItemAsync: (key, value) => setItemAsync(key, value),
  deleteItemAsync: (key) => deleteItemAsync(key),
});
