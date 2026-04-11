import { useAuthStore } from '../stores/authStore';
import { parseJwt } from './cognito-auth';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);

  const token = useAuthStore.getState().token;
  if (!token) return;

  try {
    const claims = parseJwt(token);
    const exp = (claims.exp as number) * 1000;
    const now = Date.now();
    const timeUntilExpiry = exp - now;

    if (timeUntilExpiry <= 0) {
      handleExpired();
      return;
    }

    const refreshIn = Math.max(timeUntilExpiry - REFRESH_BUFFER_MS, 10000);
    refreshTimer = setTimeout(handleExpired, refreshIn);
  } catch {
    // Invalid token
  }
}

function handleExpired() {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/team/login?expired=1';
}

export function clearTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export function getTokenExpiryMinutes(): number | null {
  const token = useAuthStore.getState().token;
  if (!token) return null;

  try {
    const claims = parseJwt(token);
    const exp = (claims.exp as number) * 1000;
    return Math.max(0, Math.round((exp - Date.now()) / 60000));
  } catch {
    return null;
  }
}
