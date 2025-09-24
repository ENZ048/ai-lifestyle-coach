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
        // Navigate to root - App.jsx will handle routing based on profile status
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600">
            {step === 'phone' 
              ? 'Enter your phone number to get started' 
              : 'Enter the verification code sent to your phone'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Include country code (e.g., +1 for US)
              </p>
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Send Verification Code
            </button>
            <div id="sign-in-recaptcha" />
          </form>
        ) : (
          <form onSubmit={confirmCode} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Change number
                </button>
              </div>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="------"
                inputMode="numeric"
                maxLength="6"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
              <p className="mt-1 text-xs text-gray-500 text-center">
                Code sent to {phone}
              </p>
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Verify & Continue
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
