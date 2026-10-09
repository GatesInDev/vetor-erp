type StoredSession = { id: string; expiresAt: Date; revokedAt: Date | null; user: { active: boolean } };

type SessionStore<T extends StoredSession> = {
  find: (hash: string) => Promise<T | null>;
  replaceHash: (sessionId: string, previousHash: string, nextHash: string, now: Date) => Promise<boolean>;
};

export async function rotateStoredSession<T extends StoredSession>(store: SessionStore<T>, previousHash: string, nextHash: string): Promise<T | null> {
  const session = await store.find(previousHash);
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || !session.user.active) return null;
  return await store.replaceHash(session.id, previousHash, nextHash, now) ? session : null;
}
