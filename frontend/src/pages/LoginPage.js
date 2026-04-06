import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CircleNotch, Backspace } from '@phosphor-icons/react';

const LOGO_URL = '/logo-full.png';

const LoginPage = () => {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const attemptLogin = async (pinToTry) => {
    setLoading(true);
    const result = await login(pinToTry);
    if (!result.success) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setError(result.error);
      setPin('');
    }
    setLoading(false);
  };

  const handlePinInput = (digit) => {
    if (pin.length >= 6 || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    // Auto-submit at 6 digits; 4-digit users tap submit or wait for auto at 6
    if (newPin.length === 6) attemptLogin(newPin);
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin(pin.slice(0, -1));
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-logo-wrap">
          <img src={LOGO_URL} alt="Ops AI" className="login-logo" data-testid="login-logo" />
        </div>

        <p className="login-subtitle">Enter your PIN to continue</p>
        
        <div className={`login-pin-dots ${shake ? 'login-shake' : ''}`} data-testid="pin-display">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`login-dot ${pin.length > i ? 'active' : ''}`}>
              {pin.length > i && <div className="login-dot-fill" />}
            </div>
          ))}
        </div>

        {error && <div className="login-error" data-testid="login-error">{error}</div>}

        {loading && (
          <div className="login-loading">
            <CircleNotch size={20} className="login-spinner" weight="bold" />
          </div>
        )}

        <div className="login-keypad" data-testid="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handlePinInput(String(digit))}
              disabled={loading}
              className="login-key"
              data-testid={`pin-btn-${digit}`}
            >
              {digit}
            </button>
          ))}
          <div className="login-key-empty" />
          <button
            onClick={() => handlePinInput('0')}
            disabled={loading}
            className="login-key"
            data-testid="pin-btn-0"
          >
            0
          </button>
          {pin.length >= 4 && pin.length < 6 ? (
            <button
              onClick={() => attemptLogin(pin)}
              disabled={loading}
              className="login-key login-key-back"
              style={{ color: '#D4A017', fontSize: 13, fontWeight: 700 }}
              data-testid="pin-btn-submit"
            >
              OK
            </button>
          ) : (
            <button
              onClick={handleBackspace}
              disabled={loading}
              className="login-key login-key-back"
              data-testid="pin-btn-back"
            >
              <Backspace size={22} weight="regular" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
