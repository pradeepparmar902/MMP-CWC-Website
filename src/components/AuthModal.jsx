import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ onClose }) => {
  const { loginWithEmail, registerWithEmail, loginWithPhone, setupRecaptcha } = useAuth();
  
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'phone'
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    // Setup recaptcha once component mounts
    setupRecaptcha('recaptcha-container');
    
    // Cleanup recaptcha on unmount
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [setupRecaptcha]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isRegistering) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message.replace('Firebase: ', '')); // Clean up the firebase error prefix
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`; // Defaults to +91 if no code provided
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err) {
      console.error(err);
      setError('Failed to send OTP. Please check the number and try again.');
      
      // Sometimes recaptcha needs to be re-initialized if it fails
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
        setupRecaptcha('recaptcha-container');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;
    
    setLoading(true);
    setError('');

    try {
      await confirmationResult.confirm(otp);
      onClose(); // Successfully verified and logged in
    } catch (err) {
      console.error(err);
      setError('Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        {/* Close Button */}
        <button className="close-btn" onClick={onClose}>&times;</button>
        
        <h2>Admin Authentication</h2>
        <p className="auth-subtitle">Verify your identity to access the portal</p>

        {/* Tab Selection */}
        <div className="auth-tabs">
          <button 
            className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setError(''); }}
          >
            Email Login
          </button>
          <button 
            className={`tab-btn ${activeTab === 'phone' ? 'active' : ''}`}
            onClick={() => { setActiveTab('phone'); setError(''); }}
          >
            Phone OTP
          </button>
        </div>

        {/* Error Message */}
        {error && <div className="auth-error">{error}</div>}

        {/* Email Tab Content */}
        {activeTab === 'email' && (
          <form className="auth-form" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                placeholder="admin@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                isRegistering ? 'Register & Login' : 'Login'
              )}
            </button>
            <div className="auth-toggle">
              <span onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Already have an account? Login' : 'Need to register? Sign up here'}
              </span>
            </div>
          </form>
        )}

        {/* Phone Tab Content */}
        {activeTab === 'phone' && (
          <div className="auth-form">
            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <div className="form-group">
                  <label>Mobile Number (India +91)</label>
                  <div className="phone-input-group">
                    <span className="country-code">+91</span>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                      required 
                      placeholder="9876543210"
                      maxLength="10"
                    />
                  </div>
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading || phone.length < 10}>
                  {loading ? <span className="spinner"></span> : 'Send OTP via SMS'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label>Enter OTP Code</label>
                  <input 
                    type="text" 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                    required 
                    placeholder="123456"
                    maxLength="6"
                    style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem' }}
                  />
                  <small className="form-hint">Code sent to +91 {phone}</small>
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading || otp.length < 6}>
                  {loading ? <span className="spinner"></span> : 'Verify Code'}
                </button>
                <div className="auth-toggle">
                  <span onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}>
                    Change Number or Resend
                  </span>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Essential for Firebase Phone Auth Invisible Captcha */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};

export default AuthModal;
