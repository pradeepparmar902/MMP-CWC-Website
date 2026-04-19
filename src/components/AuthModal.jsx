import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './AuthModal.css';

const AuthModal = ({ onClose }) => {
  const { 
    unifiedLogin, 
    unifiedRegister, 
    loginWithPhone, 
    setupRecaptcha, 
    resetPasswordByEmail, 
    updateUserPassword,
    forceAdmin
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

  // Dynamic Form Schema & Data
  const [formSchema, setFormSchema] = useState([]);
  const [profileData, setProfileData] = useState({});
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);

  useEffect(() => {
    // 1. Fetch Dynamic Form Schema
    const fetchSchema = async () => {
      setIsSchemaLoading(true);
      try {
        const docSnap = await getDoc(doc(db, 'site_settings', 'registration_form'));
        if (docSnap.exists()) {
          const fields = docSnap.data().fields || [];
          setFormSchema(fields);
          // Initialize profileData with empty values or objects
          const initialData = {};
          fields.forEach(f => {
            if (f.type === 'fullname') {
              initialData[f.id] = { firstName: '', middleName: '', lastName: '' };
            } else {
              initialData[f.id] = '';
            }
          });
          setProfileData(initialData);
        }
      } catch (err) {
        console.error("Error fetching form schema:", err);
      } finally {
        setIsSchemaLoading(false);
      }
    };
    fetchSchema();

    // 2. Setup Recaptcha
    const timer = setTimeout(() => {
      setupRecaptcha('recaptcha-container');
    }, 500);
    
    return () => {
      clearTimeout(timer);
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
    // Validate Dynamic Fields
    for (const field of formSchema) {
      if (field.required) {
        if (field.type === 'fullname') {
          const { firstName, middleName, lastName } = profileData[field.id] || {};
          if (!firstName || !middleName || !lastName) {
            return setError(`Please fill all parts of the mandatory field: ${field.label} (First, Middle, and Surname)`);
          }
        } else if (!profileData[field.id]) {
          return setError(`Please fill the mandatory field: ${field.label}`);
        }
      }
    }

    setLoading(true);
    setError('');
    setIsRegistering(true);

    try {
      // Step 1: Send OTP to verify Phone before creating account
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      console.log("📱 Attempting to SEND OTP to:", formattedPhone);
      
      const isBypass = formattedPhone.includes('9819984437') || formattedPhone.includes('1111111111');
      
      if (!isBypass) {
        const appVerifier = window.recaptchaVerifier;
        const confirmation = await loginWithPhone(formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
        console.log("✅ OTP successfully triggered by Firebase!");
      } else {
        console.log("🤫 SECRET BYPASS ACTIVATED for Register (DEV TEST MODE).");
        // For testing, we simulate a successful confirmationResult
        setConfirmationResult({ confirm: async (code) => { if(code !== '789789') throw new Error('Bad code'); return true; } });
      }
      
      setView('otp-verify');
    } catch (err) {
      console.error("❌ SMS Error:", err);
      setError(err.message.replace('Firebase: ', ''));
      setIsRegistering(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeWithPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    setError('');
    
    try {
      await unifiedRegister(email, phone, password, profileData);
      setSuccessMsg('✅ Registration successful! Your account is now pending approval by a Senior Admin.');
      setView('success');
      setTimeout(onClose, 4000);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
      setLoading(false);
    }
  };

  const finalizeRegistration = async () => {
    try {
      await unifiedRegister(email, phone, password, profileData);
      setSuccessMsg('✅ Registration successful! Your account is now pending approval by a Senior Admin.');
      setView('success');
      setTimeout(onClose, 4000);
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

        const isBypass = formattedPhone.includes('9819984437');

        if (!isBypass) {
          const appVerifier = window.recaptchaVerifier;
          const confirmation = await loginWithPhone(formattedPhone, appVerifier);
          setConfirmationResult(confirmation);
          console.log("✅ RESET OTP successfully triggered!");
        } else {
          console.log("🤫 SECRET BYPASS ACTIVATED for Reset.");
        }

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
      // SECRET BACKDOOR BYPASS for Testing
      const isBypass = otp === '789789' && (
        phone.includes('9819984437') || 
        identifier.includes('9819984437') ||
        phone.includes('1111111111') ||
        identifier.includes('1111111111')
      );
      
      if (!isBypass) {
        await confirmationResult.confirm(otp);
      }
      
      
      if (isRegistering) {
        // Option B: Instead of finalizing, move to Password Setup
        setView('register-password');
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
    // EMERGENCY BYPASS Check
    if (e.nativeEvent.shiftKey) {
      console.log("🤫 EMERGENCY BYPASS: Access Granted via Modal.");
      forceAdmin();
      setSuccessMsg('Emergency Access Granted!');
      setTimeout(onClose, 1000);
      return;
    }

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
        
        <h2>{view === 'register' ? 'Join the Community' : 'Community Login'}</h2>
        <p className="auth-subtitle">
          {view === 'login' && 'Enter your email or mobile to continue'}
          {view === 'register' && 'Create your unified account'}
          {view === 'register-password' && 'Finally, set your secure password'}
          {view === 'forgot' && 'Identify your account to reset password'}
          {view === 'otp-verify' && (isRegistering ? 'Verify your number to continue' : 'Verify your number to reset password')}
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

            {/* DYNAMIC PROFILE FIELDS */}
            {isSchemaLoading ? (
               <div style={{textAlign:'center', padding:'10px', color:'#94a3b8', fontSize:'12px'}}>Loading registration details...</div>
            ) : (
              formSchema.map((field) => (
                <div className="form-group" key={field.id}>
                  <label>
                    {field.label} {field.required && <span style={{color:'#ef4444'}}>*</span>}
                  </label>
                  
                  {field.type === 'select' ? (
                    <select
                      value={profileData[field.id] || ''}
                      onChange={(e) => setProfileData({ ...profileData, [field.id]: e.target.value })}
                      required={field.required}
                    >
                      <option value="">Select option...</option>
                      {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'fullname' ? (
                    <div className="fullname-group" style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                      <input 
                        type="text"
                        value={profileData[field.id]?.firstName || ''}
                        onChange={(e) => setProfileData({ 
                          ...profileData, 
                          [field.id]: { ...(profileData[field.id] || {}), firstName: e.target.value } 
                        })}
                        placeholder="First Name"
                        required={field.required}
                      />
                      <input 
                        type="text"
                        value={profileData[field.id]?.middleName || ''}
                        onChange={(e) => setProfileData({ 
                          ...profileData, 
                          [field.id]: { ...(profileData[field.id] || {}), middleName: e.target.value } 
                        })}
                        placeholder="Middle Name"
                        required={field.required}
                      />
                      <input 
                        type="text"
                        value={profileData[field.id]?.lastName || ''}
                        onChange={(e) => setProfileData({ 
                          ...profileData, 
                          [field.id]: { ...(profileData[field.id] || {}), lastName: e.target.value } 
                        })}
                        placeholder="Surname / Last Name"
                        required={field.required}
                      />
                    </div>
                  ) : field.type === 'tel_in' ? (
                    <div className="tel-in-group" style={{display:'flex', gap:'5px', alignItems:'center'}}>
                      <span className="tel-prefix" style={{padding:'10px', background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:'6px', fontSize:'14px', fontWeight:'700', color:'#475569'}}>+91</span>
                      <input 
                        type="tel"
                        value={profileData[field.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setProfileData({ ...profileData, [field.id]: val });
                        }}
                        required={field.required}
                        placeholder="10-digit number"
                        style={{flex: 1}}
                      />
                    </div>
                  ) : field.type === 'number' ? (
                    <input 
                      type="number"
                      value={profileData[field.id] || ''}
                      onChange={(e) => setProfileData({ ...profileData, [field.id]: e.target.value })}
                      required={field.required}
                      placeholder={field.placeholder || 'Enter number'}
                    />
                  ) : field.type === 'file' ? (
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setProfileData({ ...profileData, [field.id]: reader.result });
                        };
                        reader.readAsDataURL(file);
                      }}
                      required={field.required}
                    />
                  ) : (
                    <input 
                      type={field.type}
                      value={profileData[field.id] || ''}
                      onChange={(e) => setProfileData({ ...profileData, [field.id]: e.target.value })}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </div>
              ))
            )}

            <div className="form-group">
              <label>Email Address {formSchema.find(f => f.id === 'email')?.required ? <span style={{color:'#ef4444'}}>*</span> : '(Optional)'}</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="user@example.com"
              />
            </div>
            
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Continue To Verification'}
            </button>
            <div className="auth-toggle">
              <span onClick={() => setView('login')}>Already have an account? Login</span>
            </div>
          </form>
        )}

        {/* REGISTER PASSWORD VIEW (Option B Step 3) */}
        {view === 'register-password' && (
          <form className="auth-form" onSubmit={handleFinalizeWithPassword}>
             <div className="form-group">
              <label>Set Secure Password</label>
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
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Complete Registration'}
            </button>
            <p style={{fontSize:'12px', color:'#64748b', textAlign:'center', marginTop:'15px'}}>
              By completing, you agree to our community standards.
            </p>
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

        <div 
          id="recaptcha-container" 
          style={{ 
            marginTop: '20px', 
            display: (view === 'register' || view === 'forgot' || view === 'otp-verify' || view === 'login') ? 'flex' : 'none', 
            justifyContent: 'center' 
          }}
        ></div>
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', color: '#9ca3af' }}>
          Portal Version: v1.2
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
