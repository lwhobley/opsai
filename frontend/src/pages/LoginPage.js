import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Keypad, CircleNotch } from '@phosphor-icons/react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_cost-control-ai/artifacts/usjulrm9_IMG_2004.png';

const LoginPage = () => {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = async (digit) => {
    if (pin.length >= 6) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    // Auto-submit at 4 digits; for 6-digit PINs user taps the last digit
    if (newPin.length === 4 || newPin.length === 6) {
      setLoading(true);
      const result = await login(newPin);
      if (!result.success) {
        // If 4-digit attempt fails, allow continuing to 6 digits
        if (newPin.length === 4) {
          setLoading(false);
          return; // don't clear — let them keep typing
        }
        setError(result.error);
        setPin('');
      }
      setLoading(false);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(180deg, #0A0A12 0%, #1A1A2E 100%)',
      }}
    >
      {/* Logo */}
      <div className="mb-8 fade-in">
        <img 
          src={LOGO_URL} 
          alt="Ops AI" 
          className="w-48 h-auto"
          data-testid="login-logo"
        />
      </div>

      {/* PIN Display */}
      <div className="mb-8 flex gap-3" data-testid="pin-display">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
              pin.length > i
                ? 'bg-[#D4A017] border-[#D4A017]'
                : 'border-[#4A4A7A] bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div 
          className="mb-4 px-4 py-2 bg-[#D62828]/20 border border-[#D62828]/50 rounded-lg text-[#D62828] text-sm"
          data-testid="login-error"
        >
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="mb-4 flex items-center gap-2 text-[#D4A017]">
          <CircleNotch className="w-5 h-5 animate-spin" />
          <span className="text-sm">Verifying...</span>
        </div>
      )}

      {/* PIN Pad */}
      <div className="grid grid-cols-3 gap-4" data-testid="pin-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handlePinInput(String(digit))}
            disabled={loading}
            className="h-20 w-20 rounded-full bg-[#1A1A2E] border border-[#2B2B4A] text-2xl font-medium
                       flex items-center justify-center text-[#F5F5F0] 
                       active:bg-[#D4A017] active:text-[#0A0A12] active:scale-95
                       transition-all duration-150 disabled:opacity-50"
            data-testid={`pin-btn-${digit}`}
          >
            {digit}
          </button>
        ))}
        <button
          onClick={handleClear}
          disabled={loading}
          className="h-20 w-20 rounded-full bg-[#1A1A2E] border border-[#2B2B4A] text-sm font-medium
                     flex items-center justify-center text-[#8E8E9F]
                     active:bg-[#D62828] active:text-white active:scale-95
                     transition-all duration-150 disabled:opacity-50"
          data-testid="pin-btn-clear"
        >
          Clear
        </button>
        <button
          onClick={() => handlePinInput('0')}
          disabled={loading}
          className="h-20 w-20 rounded-full bg-[#1A1A2E] border border-[#2B2B4A] text-2xl font-medium
                     flex items-center justify-center text-[#F5F5F0]
                     active:bg-[#D4A017] active:text-[#0A0A12] active:scale-95
                     transition-all duration-150 disabled:opacity-50"
          data-testid="pin-btn-0"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={loading}
          className="h-20 w-20 rounded-full bg-[#1A1A2E] border border-[#2B2B4A] text-xl font-medium
                     flex items-center justify-center text-[#8E8E9F]
                     active:bg-[#4A4A7A] active:scale-95
                     transition-all duration-150 disabled:opacity-50"
          data-testid="pin-btn-back"
        >
          ←
        </button>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-[#5A5A70]">
        Enter your PIN to access
      </p>
    </div>
  );
};

export default LoginPage;
