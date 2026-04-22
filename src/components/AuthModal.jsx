import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { compressImage } from '../utils/imageUtils';
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
              <>
                {/* TOP PROFILE PHOTO SECTION */}
                {formSchema.filter(f => f.type === 'file').map(field => (
                  <div key={field.id} className="top-center-photo-container reg-photo-section">
                    <label className="top-photo-label">{field.label} {field.required && <span style={{color:'#ef4444'}}>*</span>}</label>
                    <div className="photo-upload-wrapper">
                      <input 
                        type="file" 
                        accept="image/*"
                        id={`reg-file-${field.id}`}
                        style={{display:'none'}}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const compressed = await compressImage(reader.result);
                            setProfileData({ ...profileData, [field.id]: compressed });
                          };
                          reader.readAsDataURL(file);
                        }}
                        required={field.required}
                      />
                      {!profileData[field.id] ? (
                        <div className="mock-file-input top-center-uploader" onClick={() => document.getElementById(`reg-file-${field.id}`).click()}>
                          <span>📷 Click to Upload Photo</span>
                        </div>
                      ) : (
                        <div className="preview-image-centered-container">
                          <img src={profileData[field.id]} alt="Profile Photo" className="preview-uploaded-img" />
                          <button type="button" className="change-preview-img-btn" onClick={() => document.getElementById(`reg-file-${field.id}`).click()}>Change Photo</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* OTHER FIELDS SECTION */}
                {formSchema.filter(f => f.type !== 'file').map((field) => (
                  <div className="form-group" key={field.id}>
                    <label>
                      {(field.label || '').replace('Emal Address', 'Email Address')} {field.required && <span style={{color:'#ef4444'}}>*</span>}
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
                    ) : field.type === 'address' ? (
                      <textarea 
                        value={profileData[field.id] || ''}
                        onChange={(e) => setProfileData({ ...profileData, [field.id]: e.target.value })}
                        required={field.required}
                        placeholder={`Enter ${field.label}...`}
                        style={{minHeight: '80px'}}
                      />
                    ) : field.type === 'email' ? (
                      <input 
                        type="email"
                        value={profileData[field.id] || ''}
                        onChange={(e) => {
                          setProfileData({ ...profileData, [field.id]: e.target.value });
                          // Sync with core email state for auth
                          setEmail(e.target.value);
                        }}
                        required={field.required}
                        placeholder={`Enter Email Address (e.g. name@example.com)`}
                      />
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
                    ) : (
                      <input 
                        type={field.type === 'email' ? 'email' : (field.type || 'text')}
                        value={profileData[field.id] || ''}
                        onChange={(e) => setProfileData({ ...profileData, [field.id]: e.target.value })}
                        required={field.required}
                        placeholder={field.placeholder || `Enter ${field.label}`}
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* STATIC EMAIL REMOVED - Dynamic field now handles it */}
            
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
