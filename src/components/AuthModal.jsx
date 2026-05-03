import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DynamicForm from './common/DynamicForm';
import './AuthModal.css';

const AuthModal = ({ onClose, initialView = 'login' }) => {
  const { 
    unifiedLogin, 
    unifiedRegister, 
    loginWithPhone, 
    checkPhoneRegistered,
    setupRecaptcha, 
    changeMobileNumber,
    resetPasswordByEmail, 
    updateUserPassword,
    currentUser,
    forceAdmin
  } = useAuth();
  
  // Views: 'login', 'register', 'forgot', 'otp-verify', 'new-password', 'success', 'profile', 'change-phone'
  const [view, setView] = useState(initialView);
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
  const [otpMode, setOtpMode] = useState('register'); // 'register', 'reset', 'change-phone'
  const [newPhoneNumber, setNewPhoneNumber] = useState(''); 


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
          
          // Initialize profileData only if it's currently empty to avoid wiping data on re-mounts
          if (Object.keys(profileData).length === 0) {
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
        const val = profileData[field.id];
        if (field.type === 'fullname') {
          const { firstName, lastName } = val || {};
          if (!firstName?.trim() || !lastName?.trim()) {
            return setError(`Please fill all mandatory parts of: ${field.label} (First Name and Surname at minimum)`);
          }
        } else if (field.type === 'file') {
          if (!val) return setError(`Please upload the mandatory: ${field.label}`);
        } else if (!val || (typeof val === 'string' && !val.trim())) {
          return setError(`Please fill the mandatory field: ${field.label}`);
        }
      }
    }

    setLoading(true);
    setError('');

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      
      // Step 1: Pre-flight check - ensure number isn't already registered
      const isRegistered = await checkPhoneRegistered(formattedPhone);
      if (isRegistered) {
        setLoading(false);
        return setError("This mobile number is already registered.");
      }

      // Step 2: Send OTP to verify Phone before creating account
      console.log("📱 Attempting to SEND OTP to:", formattedPhone);
      
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      console.log("✅ OTP successfully triggered by Firebase!");
      
      setView('otp-verify');
    } catch (err) {
      console.error("❌ SMS Error:", err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleStartPhoneChange = async (e) => {
    e.preventDefault();
    if (!newPhoneNumber) return;
    
    setLoading(true);
    setError('');
    const formattedNew = newPhoneNumber.startsWith('+') ? newPhoneNumber : `+91${newPhoneNumber}`;
    
    try {
      console.log("📱 Verifying NEW phone number:", formattedNew);
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await loginWithPhone(formattedNew, appVerifier);
      setConfirmationResult(confirmation);
      setOtpMode('change-phone');
      setView('otp-verify');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
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
      console.log("🚀 FINALIZING REGISTRATION:", { email, phone, profile: profileData });
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
        setConfirmationResult(confirmation);
        console.log("✅ RESET OTP successfully triggered!");

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
      
      if (otpMode === 'change-phone') {
         const oldPhone = currentUser?.email?.split('@')[0]; // Extracting from virtual email 
         await changeMobileNumber(currentUser.uid, oldPhone, newPhoneNumber);
         setSuccessMsg('✅ Mobile number updated successfully! Please login with your new number.');
         setView('success');
         // Log out so they can log back in with the new number (it's cleaner)
         setTimeout(() => {
           window.location.reload(); 
         }, 2000);
      } else if (otpMode === 'register') {
        setView('register-password');
      } else {
        setView('new-password');
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP code.');
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
        
        <h2>
          {view === 'register' ? 'Join the Community' : 
           view === 'profile' ? 'My Profile' :
           view === 'change-phone' ? 'Change Mobile' :
           'Community Login'}
        </h2>
        <p className="auth-subtitle">
          {view === 'login' && 'Enter your email or mobile to continue'}
          {view === 'register' && 'Create your unified account'}
          {view === 'register-password' && 'Finally, set your secure password'}
          {view === 'forgot' && 'Identify your account to reset password'}
          {view === 'otp-verify' && (otpMode === 'change-phone' ? 'Verify your new number' : 'Verify your number to continue')}
          {view === 'new-password' && 'Set your new secure password'}
          {view === 'profile' && 'Manage your account and identity'}
          {view === 'change-phone' && 'Enter your new mobile number to migrate'}
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
          <div className="auth-form">
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

            <DynamicForm 
              schema={formSchema}
              data={profileData}
              setData={setProfileData}
              onSubmit={handleRegister}
              loading={loading}
              submitText="Continue To Verification"
            />
            
            <div className="auth-toggle">
              <span onClick={() => setView('login')}>Already have an account? Login</span>
            </div>
          </div>
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

        {/* PROFILE VIEW */}
        {view === 'profile' && (
           <div className="profile-settings-view">
              <div className="profile-info-card">
                 <div className="profile-info-row">
                    <span className="info-label">Current Mobile</span>
                    <span className="info-value">
                       {currentUser?.email?.endsWith('@mmp-cwc.admin') 
                         ? `+${currentUser.email.split('@')[0]}` 
                         : currentUser?.phoneNumber || 'Not Linked'}
                    </span>
                 </div>
                 <div className="profile-info-row">
                    <span className="info-label">Account UID</span>
                    <span className="info-value" style={{fontSize:'10px', opacity: 0.6}}>{currentUser?.uid}</span>
                 </div>
              </div>
              
              <div className="profile-actions">
                 <button className="auth-submit-btn secondary" onClick={() => setView('change-phone')}>
                   📱 Change Mobile Number
                 </button>
                 <button className="dropdown-item logout-item" style={{width:'100%', marginTop:'10px', padding:'12px'}} onClick={() => { logout(); onClose(); }}>
                   🚪 Logout from Account
                 </button>
              </div>
           </div>
        )}

        {/* CHANGE PHONE VIEW */}
        {view === 'change-phone' && (
           <form className="auth-form" onSubmit={handleStartPhoneChange}>
             <div className="form-group">
               <label>New Mobile Number (+91)</label>
               <input 
                 type="tel" 
                 value={newPhoneNumber} 
                 onChange={(e) => setNewPhoneNumber(e.target.value)} 
                 required 
                 placeholder="Enter 10-digit number"
                 autoFocus
               />
             </div>
             <button type="submit" className="auth-submit-btn" disabled={loading}>
               {loading ? <span className="spinner"></span> : 'Verify New Number'}
             </button>
             <div className="auth-toggle">
               <span onClick={() => setView('profile')}>Cancel and go back</span>
             </div>
           </form>
        )}

        {/* Success / Loading Transition Area */}

        {view === 'success' && (
           <div className="auth-success-state">
              <div className="success-icon">✓</div>
           </div>
        )}

        {/* Global ReCaptcha Container (Stay visible but unobtrusive for Invisible mode) */}
        <div 
          id="recaptcha-container" 
          style={{ 
            opacity: 0, 
            position: 'absolute', 
            pointerEvents: 'none',
            zIndex: -1
          }}
        ></div>
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', color: '#9ca3af' }}>
          Portal Version: v1.2.1
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
