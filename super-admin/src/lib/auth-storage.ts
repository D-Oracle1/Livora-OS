/**
 * Auth storage utilities.
 *
 * In PWA standalone mode (iOS/Android home screen), uses localStorage
 * so auth persists across app launches.
 * In regular browser, uses sessionStorage for tab isolation.
 */

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function getStorage(): Storage {
  return isPwaStandalone() ? localStorage : sessionStorage;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const storage = getStorage();
  // Also check the other storage as fallback (user might have switched modes)
  return storage.getItem(TOKEN_KEY) || (isPwaStandalone() ? sessionStorage.getItem(TOKEN_KEY) : localStorage.getItem(TOKEN_KEY));
}

export function getUser(): { id: string; firstName: string; lastName: string; email: string; role: string; avatar?: string; companyId?: string; isSuperAdmin?: boolean; referralCode?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = getStorage();
    let stored = storage.getItem(USER_KEY);
    // Fallback to other storage
    if (!stored) {
      stored = isPwaStandalone() ? sessionStorage.getItem(USER_KEY) : localStorage.getItem(USER_KEY);
    }
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: Record<string, any>): void {
  const storage = getStorage();
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  // In PWA mode, also write to sessionStorage so within-session reads work
  if (isPwaStandalone()) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function updateUser(updates: Record<string, any>): void {
  try {
    const storage = getStorage();
    let stored = storage.getItem(USER_KEY);
    if (!stored) {
      stored = isPwaStandalone() ? sessionStorage.getItem(USER_KEY) : localStorage.getItem(USER_KEY);
    }
    if (stored) {
      const user = JSON.parse(stored);
      const updated = { ...user, ...updates };
      const json = JSON.stringify(updated);
      storage.setItem(USER_KEY, json);
      if (isPwaStandalone()) {
        sessionStorage.setItem(USER_KEY, json);
      }
      window.dispatchEvent(new CustomEvent('user-updated'));
    }
  } catch {}
}

export function clearAuth(): void {
  // Clear from both storages to ensure complete logout
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
