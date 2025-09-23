import { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export default function SignIn() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [error, setError] = useState('');
  const verifierRef = useRef(null);
  const confirmationRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize invisible reCAPTCHA
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, 'sign-in-recaptcha', {
        size: 'invisible',
      });
    }
  }, []);

  const sendCode = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const confirmation = await signInWithPhoneNumber(auth, phone, verifierRef.current);
      confirmationRef.current = confirmation;
      setStep('code');
    } catch (err) {
      setError(err.message || 'Failed to send code');
      // Reset captcha on failure
      try { await verifierRef.current?.render(); } catch {}
    }
  };

  const confirmCode = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await confirmationRef.current.confirm(code);
      if (result.user) {
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <label className="block">
              <span className="text-sm text-gray-700">Phone number</span>
              <input
                type="tel"
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Send code
            </button>
            <div id="sign-in-recaptcha" />
          </form>
        ) : (
          <form onSubmit={confirmCode} className="space-y-4">
            <label className="block">
              <span className="text-sm text-gray-700">Verification code</span>
              <input
                type="text"
                className="mt-1 w-full border rounded px-3 py-2 tracking-widest"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Verify & Continue
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
