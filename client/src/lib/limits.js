import { useEffect, useState } from 'react';
import { api } from './api.js';

// Used until (or if) /api/config answers. Matches the server defaults.
export const DEFAULT_LIMITS = {
  maxFiles: 10,
  maxFileSize: 100 * 1024 * 1024,
  maxTextLength: 500000,
  defaultExpiryMinutes: 1440,
  maxExpiryMinutes: 43200
};

let cached = null;
let pending = null;

function loadLimits() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = api('/api/config')
      .then((data) => {
        cached = { ...DEFAULT_LIMITS, ...data };
        return cached;
      })
      .catch(() => {
        pending = null;
        return DEFAULT_LIMITS;
      });
  }
  return pending;
}

/** Server limits (file size, count, text length, default expiry), kept in sync automatically. */
export function useLimits() {
  const [limits, setLimits] = useState(cached || DEFAULT_LIMITS);

  useEffect(() => {
    let cancelled = false;
    loadLimits().then((value) => {
      if (!cancelled) setLimits(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return limits;
}

/** 1440 -> "24 hours", 90 -> "90 minutes", 43200 -> "30 days". */
export function formatDuration(minutes) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '24 hours' : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
