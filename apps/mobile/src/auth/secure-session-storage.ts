export interface SecureKeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SecureSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  markLogoutCleanupRequired(key: string): Promise<void>;
  getLogoutCleanupRequired(key: string): Promise<boolean>;
  clearLogoutCleanupRequired(key: string): Promise<void>;
  withLogoutCleanupReadAuthority<Result>(
    key: string,
    operation: () => Promise<Result>,
  ): Promise<Result>;
}

type Bank = 'a' | 'b';

interface Manifest {
  version: 1;
  bank: Bank;
  chunkCount: number;
}

const CHUNK_BYTES = 1800;
const MAX_CHUNKS = 32;
const manifestKey = (key: string) => `${key}.secure-manifest`;
const cleanupKey = (key: string) => `${key}.secure-cleanup`;
const logoutCleanupRequiredKey = (key: string) =>
  `${key}.secure-cleanup-required`;
const chunkKey = (key: string, bank: Bank, index: number) =>
  `${key}.secure-${bank}-${index}`;

const characterBytes = (character: string): number => {
  const point = character.codePointAt(0) ?? 0;
  if (point <= 0x7f) return 1;
  if (point <= 0x7ff) return 2;
  if (point <= 0xffff) return 3;
  return 4;
};

export const chunkSessionPayload = (
  value: string,
  chunkBytes = CHUNK_BYTES,
): string[] => {
  if (value.length === 0) return [];
  if (!Number.isInteger(chunkBytes) || chunkBytes < 4) {
    throw new Error('The secure storage chunk size is invalid.');
  }

  const chunks: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const character of value) {
    const size = characterBytes(character);
    if (bytes + size > chunkBytes) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += character;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
};

const parseManifest = (value: string | null): Manifest | null => {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('version' in candidate) ||
      candidate.version !== 1 ||
      !('bank' in candidate) ||
      (candidate.bank !== 'a' && candidate.bank !== 'b') ||
      !('chunkCount' in candidate) ||
      !Number.isInteger(candidate.chunkCount) ||
      typeof candidate.chunkCount !== 'number' ||
      candidate.chunkCount < 0 ||
      candidate.chunkCount > MAX_CHUNKS
    ) {
      return null;
    }
    return {
      version: 1,
      bank: candidate.bank,
      chunkCount: candidate.chunkCount,
    };
  } catch {
    return null;
  }
};

const isSessionJson = (value: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
};

export const createSecureSessionStorage = (
  store: SecureKeyValueStore,
): SecureSessionStorage => {
  let operationQueue = Promise.resolve();
  const logoutReadAuthority = new Map<string, symbol>();
  const logoutReadLockTakenOutOfBand = new Set<string>();

  const exclusive = <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const result = operationQueue.then(operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const deleteAll = async (keys: string[]): Promise<void> => {
    const results = await Promise.allSettled(
      keys.map((storedKey) => store.deleteItemAsync(storedKey)),
    );
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error(
        'Secure authentication data could not be completely removed.',
      );
    }
  };

  const clearBank = (key: string, bank: Bank): Promise<void> =>
    deleteAll(
      Array.from({ length: MAX_CHUNKS }, (_, index) =>
        chunkKey(key, bank, index),
      ),
    );

  const clearAll = (key: string): Promise<void> =>
    deleteAll([
      manifestKey(key),
      cleanupKey(key),
      ...Array.from({ length: MAX_CHUNKS }, (_, index) =>
        chunkKey(key, 'a', index),
      ),
      ...Array.from({ length: MAX_CHUNKS }, (_, index) =>
        chunkKey(key, 'b', index),
      ),
    ]);

  const settlePendingCleanup = async (
    key: string,
    protectedBank: Bank,
  ): Promise<void> => {
    const storedCleanup = await store.getItemAsync(cleanupKey(key));

    // With a committed manifest, only the opposite bank can be stale. Cleanup
    // metadata is advisory and must never select the committed bank for deletion.
    await clearBank(key, protectedBank === 'a' ? 'b' : 'a');
    if (storedCleanup !== null) {
      await store.deleteItemAsync(cleanupKey(key));
    }
  };

  const requireFinishedLogoutCleanup = async (
    key: string,
    allowOwnedLogoutRead = false,
  ): Promise<void> => {
    const required = await store.getItemAsync(logoutCleanupRequiredKey(key));
    if (
      required !== null &&
      !(allowOwnedLogoutRead && logoutReadAuthority.has(key))
    ) {
      throw new Error(
        'Local logout cleanup is required before authentication storage can be used.',
      );
    }
  };

  const discardCorruptValue = async (key: string): Promise<null> => {
    await clearAll(key);
    return null;
  };

  const getItem = (key: string): Promise<string | null> =>
    exclusive(async () => {
      await requireFinishedLogoutCleanup(key, true);
      const storedManifest = await store.getItemAsync(manifestKey(key));
      const manifest = parseManifest(storedManifest);
      if (!manifest) {
        return discardCorruptValue(key);
      }

      await settlePendingCleanup(key, manifest.bank);

      const chunks = await Promise.all(
        Array.from({ length: manifest.chunkCount }, (_, index) =>
          store.getItemAsync(chunkKey(key, manifest.bank, index)),
        ),
      );
      if (chunks.some((chunk) => chunk === null)) {
        return discardCorruptValue(key);
      }

      const value = chunks.join('');
      if (!isSessionJson(value)) {
        return discardCorruptValue(key);
      }
      return value;
    });

  const setItem = (key: string, value: string): Promise<void> =>
    exclusive(async () => {
      await requireFinishedLogoutCleanup(key);
      const chunks = chunkSessionPayload(value);
      if (chunks.length > MAX_CHUNKS) {
        throw new Error(
          'The authentication session is too large for secure storage.',
        );
      }

      const storedManifest = await store.getItemAsync(manifestKey(key));
      const previous = parseManifest(storedManifest);
      if (previous) {
        await settlePendingCleanup(key, previous.bank);
      } else {
        await clearAll(key);
      }

      const nextBank: Bank = previous?.bank === 'a' ? 'b' : 'a';
      const nextManifest: Manifest = {
        version: 1,
        bank: nextBank,
        chunkCount: chunks.length,
      };

      try {
        if (previous) {
          await clearBank(key, nextBank);
        }
        for (const [index, chunk] of chunks.entries()) {
          await store.setItemAsync(chunkKey(key, nextBank, index), chunk);
        }
        await store.setItemAsync(
          manifestKey(key),
          JSON.stringify(nextManifest),
        );
      } catch {
        try {
          await clearBank(key, nextBank);
        } catch {
          // The failed operation remains rejected even if its rollback also fails.
        }
        throw new Error(
          'The authentication session could not be securely saved.',
        );
      }

      if (previous) {
        try {
          await clearBank(key, previous.bank);
        } catch {
          try {
            await store.setItemAsync(
              cleanupKey(key),
              JSON.stringify({ version: 1, bank: previous.bank }),
            );
          } catch {
            // Reject below: an unrecorded cleanup failure is not a success.
          }
          throw new Error(
            'The authentication session was saved, but its previous data could not be completely removed.',
          );
        }
      }
    });

  const removeItem = (key: string): Promise<void> =>
    exclusive(() => clearAll(key));

  const markLogoutCleanupRequired = (key: string): Promise<void> =>
    exclusive(() => store.setItemAsync(logoutCleanupRequiredKey(key), '1'));

  const getLogoutCleanupRequired = (key: string): Promise<boolean> =>
    exclusive(
      async () =>
        (await store.getItemAsync(logoutCleanupRequiredKey(key))) !== null,
    );

  const clearLogoutCleanupRequired = (key: string): Promise<void> =>
    exclusive(() => store.deleteItemAsync(logoutCleanupRequiredKey(key)));

  const withLogoutCleanupReadAuthority = async <Result>(
    key: string,
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const owner = Symbol(key);
    await exclusive(() => {
      if (logoutReadLockTakenOutOfBand.has(key)) {
        throw new Error(
          'A local logout cleanup read operation is already active.',
        );
      }
      logoutReadLockTakenOutOfBand.add(key);
      logoutReadAuthority.set(key, owner);
      return Promise.resolve();
    });

    try {
      return await operation();
    } finally {
      if (logoutReadAuthority.get(key) === owner) {
        logoutReadAuthority.delete(key);
      }
      await exclusive(() => {
        if (logoutReadAuthority.get(key) === undefined) {
          logoutReadLockTakenOutOfBand.delete(key);
        }
        return Promise.resolve();
      });
    }
  };

  return {
    getItem,
    setItem,
    removeItem,
    markLogoutCleanupRequired,
    getLogoutCleanupRequired,
    clearLogoutCleanupRequired,
    withLogoutCleanupReadAuthority,
  };
};
