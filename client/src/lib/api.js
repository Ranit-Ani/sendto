/* ==================================================================
   SendTo — API + shared helper utilities.
   Ported from the original public/assets/js/app.js, kept behaviourally
   identical so every existing feature keeps working exactly as before.
   ================================================================== */

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 'NETWORK', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty body */
  }

  if (!response.ok) {
    const error = (data && data.error) || {};
    throw new ApiError(error.message || 'Something went wrong.', error.code || 'UNKNOWN', response.status);
  }
  return data;
}

/** Upload with progress, because fetch cannot report it. */
export function upload(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', path);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      let data = null;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        /* ignore */
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(data);
      } else {
        const error = (data && data.error) || {};
        reject(new ApiError(error.message || 'Upload failed.', error.code || 'UNKNOWN', request.status));
      }
    });

    request.addEventListener('error', () =>
      reject(new ApiError('Cannot reach the server. Check your connection and try again.', 'NETWORK', 0))
    );
    request.addEventListener('abort', () => reject(new ApiError('Upload cancelled.', 'ABORTED', 0)));

    request.send(formData);
  });
}

export async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand('copy');
    helper.remove();
    return ok;
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** "2 hours 15 minutes" style countdown used on result and receive views. */
export function formatRemaining(timestamp) {
  if (!timestamp) return 'No expiry';
  const ms = timestamp - Date.now();
  if (ms <= 0) return 'Expired';

  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours} hr`;
  if (hours > 0) return `${hours} hr ${mins} min`;
  if (minutes > 0) return `${minutes} min`;
  return 'Less than a minute';
}

/** Reads ?code=123456 so share links open ready to go. */
export function codeFromUrl(search) {
  const value = new URLSearchParams(search).get('code') || '';
  const digits = value.replace(/\D/g, '');
  return digits.length === 6 ? digits : '';
}

export function sanitizeCodeInput(value) {
  return value.replace(/\D/g, '').slice(0, 6);
}
