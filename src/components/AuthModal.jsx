import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ onClose }) => {
  const { 
    unifiedLogin, 
    unifiedRegister, 
    loginWithPhone, 
    setupRecaptcha, 
    resetPasswordByEmail, 
    updateUserPassword 
  } = useAuth();
  
  // States: 'login', 'register', 'forgot', 'otp-verify', 'new-password', 'success'
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Phone OTP specific
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false); // To track if OTP is for registration

  useEffect(() => {
    setupRecaptcha('recaptcha-container');
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [setupRecaptcha]);

  const handleUnifiedLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await unifiedLogin(identifier, password);
      onClose();
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    setError('');
    setIsRegistering(true);

    try {
      // Step 1: Send OTP to verify Phone before creating account
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      console.log("📱 Attempting to SEND OTP to:", formattedPhone);
      
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      console.log("✅ OTP successfully triggered by Firebase!");
      
      setConfirmationResult(confirmation);
      setView('otp-verify');
    } catch (err) {
      console.error("❌ SMS Error:", err);
      setError(err.message.replace('Firebase: ', ''));
      setIsRegistering(false);
    } finally {
      setLoading(false);
    }
  };

  const finalizeRegistration = async () => {
    try {
      await unifiedRegister(email, phone, password);
      setSuccessMsg('Phone verified! Registration successful.');
      setView('success');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
      setView('register');
      setIsRegistering(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Check if identifier is phone or email
    const isEmail = identifier.includes('@');
    
    try {
      if (isEmail) {
        await resetPasswordByEmail(identifier);
        setSuccessMsg('Reset link sent to your email!');
        setView('success');
      } else {
        // Phone Reset Path - Step 1: Send OTP
        const formattedPhone = identifier.startsWith('+') ? identifier : `+91${identifier}`;
        console.log("📱 Sending RESET OTP to:", formattedPhone);

        const appVerifier = window.recaptchaVerifier;
        const confirmation = await loginWithPhone(formattedPhone, appVerifier);
        console.log("✅ RESET OTP successfully triggered!");

        setConfirmationResult(confirmation);
        setView('otp-verify');
      }
    } catch (err) {
      console.error("❌ Reset SMS Error:", err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await confirmationResult.confirm(otp);
      
      if (isRegistering) {
        // If we were registering, now create the actual account
        await finalizeRegistration();
      } else {
        // Logged in via Phone (Reset Path)! Now allow them to set a new password
        setView('new-password');
      }
    } catch (err) {
      setError('Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    setError('');
    try {
      await updateUserPassword(password);
      setSuccessMsg('Password updated successfully!');
      setView('success');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <button className="close-btn" onClick={onClose}>&times;</button>
        
        <h2>{view === 'register' ? 'Join the Portal' : 'Admin Portal'}</h2>
        <p className="auth-subtitle">
          {view === 'login' && 'Enter your email or mobile to continue'}
          {view === 'register' && 'Create your unified admin account'}
          {view === 'forgot' && 'Identify your account to reset password'}
          {view === 'otp-verify' && (isRegistering ? 'Verify your number to create account' : 'Verify your number to reset password')}
          {view === 'new-password' && 'Set your new secure password'}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {successMsg && <div className="auth-success">{successMsg}</div>}

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <form className="auth-form" onSubmit={handleUnifiedLogin}>
            <div className="form-group">
              <label>Email or Mobile Number</label>
              <input 
                value={identifier} 
                onChange={(e) => setIdentifier(e.target.value)} 
                required 
                placeholder="email@example.com or 9876543210"
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
            <div className="auth-utility-links">
               <span onClick={() => setView('forgot')}>Forgot Password?</span>
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Login'}
            </button>
            <div className="auth-toggle">
              <span onClick={() => setView('register')}>Need an account? Sign up</span>
            </div>
          </form>
        )}

        {/* REGISTER VIEW */}
        {view === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label>Mobile Number (+91)</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
                placeholder="9876543210"
              />
            </div>
            <div className="form-group">
              <label>Email Address (Optional)</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="admin@example.com"
              />
            </div>
            <div className="form-group">
              <label>Set Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
            <div id="recaptcha-container" className="recaptcha-box" style={{ margin: '15px 0', display: 'flex', justifyContent: 'center' }}></div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Register & Access'}
            </button>
            <div className="auth-toggle">
              <span onClick={() => setView('login')}>Already have an account? Login</span>
            </div>
          </form>
        )}

        {/* FORGOT VIEW */}
        {view === 'forgot' && (
          <form className="auth-form" onSubmit={handleForgotSubmit}>
            <div className="form-group">
              <label>Enter Registered Email or Mobile</label>
              <input 
                value={identifier} 
                onChange={(e) => setIdentifier(e.target.value)} 
                required 
                placeholder="email@example.com or 9876543210"
              />
            </div>
            <div id="recaptcha-container" style={{ margin: '15px 0', display: 'flex', justifyContent: 'center' }}></div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Send Reset Request'}
            </button>
            <div className="auth-toggle">
              <span onClick={() => setView('login')}>Back to Login</span>
            </div>
          </form>
        )}

        {/* OTP VERIFY (Mobile Reset Path) */}
        {view === 'otp-verify' && (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label>Enter 6-Digit OTP</label>
              <input 
                type="text" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)} 
                required 
                placeholder="123456"
                maxLength="6"
                style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem' }}
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* NEW PASSWORD (Mobile Reset Path) */}
        {view === 'new-password' && (
          <form className="auth-form" onSubmit={handleUpdatePassword}>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Update Password'}
            </button>
          </form>
        )}

        {/* Success / Loading Transition Area */}
        {view === 'success' && (
           <div className="auth-success-state">
              <div className="success-icon">✓</div>
           </div>
        )}

      </div>
    </div>
  );
};

export default AuthModal;
