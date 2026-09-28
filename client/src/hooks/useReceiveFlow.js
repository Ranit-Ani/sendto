import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, codeFromUrl, sanitizeCodeInput } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * @param {object} options
 * @param {'file'|'text'} options.type
 * @param {(payload: object) => void} options.onOpen
 * @param {string} options.otherTypePath  path to send the user to if the code holds the other content type
 */
export function useReceiveFlow({ type, onOpen, otherTypePath }) {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [step, setStepState] = useState('code');
  const [codeValue, setCodeValue] = useState('');
  const [codeError, setCodeError] = useState(null); // { message, html }
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [checking, setChecking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const codeRef = useRef('');
  const workingRef = useRef(false);
  const prefilledRef = useRef(false);

  const setStep = useCallback((name) => setStepState(name), []);

  const open = useCallback(
    async (password) => {
      workingRef.current = true;
      if (password === '') setChecking(true);
      else setUnlocking(true);
      setCodeError(null);
      setPasswordError('');

      try {
        const payload = await api(`/api/shares/${codeRef.current}/open`, {
          method: 'POST',
          body: { password, type }
        });
        setStep('content');
        onOpen(payload);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        if (error.code === 'PASSWORD_REQUIRED' || error.code === 'WRONG_PASSWORD') {
          setStep('password');
          setPasswordValue('');
          if (error.code === 'WRONG_PASSWORD') setPasswordError(error.message);
        } else {
          setStep('code');
          setCodeError({ message: error.message });
        }
        toast(error.message, 'error');
      } finally {
        workingRef.current = false;
        setChecking(false);
        setUnlocking(false);
      }
    },
    [onOpen, setStep, toast, type]
  );

  const lookup = useCallback(async (codeOverride) => {
    if (workingRef.current) return;

    const value = sanitizeCodeInput(codeOverride ?? codeValue);
    if (value.length !== 6) {
      setCodeError({ message: 'Enter the full 6-digit code.' });
      return;
    }

    codeRef.current = value;
    workingRef.current = true;
    setChecking(true);
    setCodeError(null);

    try {
      const info = await api(`/api/shares/${value}`);

      if (info.type !== type) {
        const target = otherTypePath;
        const label = info.type === 'text' ? 'shared text' : 'shared files';
        setCodeError({
          html: `That code holds ${label}. <a href="${target}?code=${value}">Open it here</a>.`
        });
        workingRef.current = false;
        setChecking(false);
        return;
      }

      if (info.passwordProtected) {
        setStep('password');
        workingRef.current = false;
        setChecking(false);
        return;
      }

      workingRef.current = false;
      setChecking(false);
      await open('');
    } catch (error) {
      setCodeError({ message: error.message });
      toast(error.message, 'error');
      workingRef.current = false;
      setChecking(false);
    }
  }, [codeValue, open, otherTypePath, setStep, toast, type]);

  const unlock = useCallback(async () => {
    if (workingRef.current) return;
    if (!passwordValue) {
      setPasswordError('Enter the password to continue.');
      return;
    }
    await open(passwordValue);
  }, [open, passwordValue]);

  const reset = useCallback(() => {
    codeRef.current = '';
    setCodeValue('');
    setPasswordValue('');
    setCodeError(null);
    setPasswordError('');
    setStep('code');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setStep]);

  // A scanned QR code (or any code picked elsewhere) is looked up straight away.
  const submitCode = useCallback(
    (value) => {
      const digits = sanitizeCodeInput(value);
      setCodeValue(digits);
      lookup(digits);
    },
    [lookup]
  );

  // Share links arrive as /receive-text?code=482731. The ref guard makes sure
  // this runs once even when React StrictMode mounts effects twice in dev,
  // otherwise a link would count two views.
  useEffect(() => {
    if (prefilledRef.current) return;
    const prefill = codeFromUrl(location.search);
    if (prefill) {
      prefilledRef.current = true;
      setCodeValue(prefill);
      codeRef.current = prefill;
      workingRef.current = false;
      lookup(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    step,
    codeValue,
    setCodeValue: (v) => {
      setCodeValue(sanitizeCodeInput(v));
      setCodeError(null);
    },
    codeError,
    passwordValue,
    setPasswordValue,
    passwordError,
    checking,
    unlocking,
    lookup,
    submitCode,
    unlock,
    reset,
    navigate
  };
}
