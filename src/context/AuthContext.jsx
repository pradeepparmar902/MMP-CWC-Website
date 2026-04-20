import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSamajAdmin, setIsSamajAdmin] = useState(false);
  const [isEduAdmin, setIsEduAdmin] = useState(false);
  const [userStatus, setUserStatus] = useState(null); // 'pending', 'approved', 'rejected'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeRole = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      if (user) {
        setCurrentUser(user);
        
        // ROOT SUPER ADMIN CHECK
        if (user.email?.toLowerCase() === 'admin@cwc.com') {
          setIsSuperAdmin(true);
          setIsAdmin(true);
          setIsSamajAdmin(true);
          setIsEduAdmin(true);
          setUserStatus('approved');
          setLoading(false);
          return;
        }

        // 🛡️ ENHANCED REAL-TIME ROLE SYNC
        const adminDocRef = doc(db, 'admins', user.uid);
        
        // CHECK MANUAL LINKING: If not found by UID, check by phone
        const handleActivation = async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const r = userData.role;
            
            setIsAdmin(['super', 'admin', 'samaj_admin', 'edu_admin'].includes(r));
            setIsSuperAdmin(r === 'super' || r === 'admin');
            setIsSamajAdmin(r === 'samaj_admin' || r === 'super' || r === 'admin'); 
            setIsEduAdmin(r === 'edu_admin' || r === 'super' || r === 'admin');  
            setUserStatus(userData.status || 'approved');
          } else {
             // FALLBACK: Search by Phone for "Manual Whitelist"
             try {
                const phoneNumeric = user.phoneNumber ? user.phoneNumber.replace(/\D/g, '') : null;
                if (phoneNumeric) {
                  const q = query(collection(db, 'admins'), where('phone', '>=', phoneNumeric.slice(-10)));
                  const querySnap = await getDocs(q);
                  const manualAdmin = querySnap.docs.find(d => d.data().phone && d.data().phone.replace(/\D/g, '').endsWith(phoneNumeric.slice(-10)));
                  
                  if (manualAdmin && manualAdmin.id.startsWith('manual_')) {
                    // AUTO-LINK: Attach real UID to the manual whitelist
                    await setDoc(doc(db, 'admins', user.uid), {
                      ...manualAdmin.data(),
                      uid: user.uid,
                      linkedAt: new Date().toISOString()
                    });
                    // Delete manual entry after linking
                    await deleteDoc(doc(db, 'admins', manualAdmin.id));
                    return; // The next onSnapshot will trigger correctly
                  }
                }
             } catch (e) {
                console.error("Manual link check failed:", e);
             }

            const pendingDoc = await getDoc(doc(db, 'pending_users', user.uid));
            setUserStatus(pendingDoc.exists() ? pendingDoc.data().status : null);
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setIsSamajAdmin(false);
            setIsEduAdmin(false);
          }
          setLoading(false);
        };

        unsubscribeRole = onSnapshot(adminDocRef, handleActivation);

      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsSamajAdmin(false);
        setIsEduAdmin(false);
        setUserStatus(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRole) unsubscribeRole();
    };
  }, []);

  const unifiedLogin = async (identifier, password) => {
    let email = identifier;
    
    // Check if identifier is a phone number (simple regex for digits)
    if (/^\+?\d+$/.test(identifier.replace(/\s/g, ''))) {
      const formattedPhone = identifier.startsWith('+') ? identifier : `+91${identifier}`;
      const mappingDoc = await getDoc(doc(db, 'user_mappings', formattedPhone));
      if (!mappingDoc.exists()) {
        throw new Error('No account found with this mobile number.');
      }
      email = mappingDoc.data().email;
    }

    return signInWithEmailAndPassword(auth, email, password);
  };

  const unifiedRegister = async (email, phone, password, profileData = {}) => {
    // 1. Check if phone already exists
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    const mappingDoc = await getDoc(doc(db, 'user_mappings', formattedPhone));
    if (mappingDoc.exists()) {
      throw new Error('This mobile number is already registered.');
    }

    // 2. Handle optional email (Generate virtual email if empty)
    const finalEmail = email || `${formattedPhone.replace('+', '')}@mmp-cwc.admin`;

    // 3. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
    const user = userCredential.user;

    // 4. Save mapping in Firestore user_mappings
    await setDoc(doc(db, 'user_mappings', formattedPhone), {
      email: finalEmail,
      realEmail: email || null,
      uid: user.uid,
      createdAt: new Date().toISOString()
    });

    // 5. Add to pending_users queue with dynamic profile
    await setDoc(doc(db, 'pending_users', user.uid), {
      uid: user.uid,
      phone: formattedPhone,
      email: email || null,
      virtualEmail: finalEmail,
      status: 'pending',
      registeredAt: new Date().toISOString(),
      profile: profileData // Dynamic fields from the registration form builder
    });

    return userCredential;
  };

  const resetPasswordByEmail = (email) => sendPasswordResetEmail(auth, email);

  const updateUserPassword = (newPassword) => {
    if (!auth.currentUser) throw new Error("No user logged in.");
    return updatePassword(auth.currentUser, newPassword);
  };

  const changeMobileNumber = async (uid, oldPhone, newPhone) => {
    const formattedOld = oldPhone.startsWith('+') ? oldPhone : `+91${oldPhone}`;
    const formattedNew = newPhone.startsWith('+') ? newPhone : `+91${newPhone}`;

    // 1. Check if NEW number is already taken
    const mappingDoc = await getDoc(doc(db, 'user_mappings', formattedNew));
    if (mappingDoc.exists()) throw new Error('New mobile number is already registered.');

    // 2. Fetch OLD mapping data
    const oldMappingDoc = await getDoc(doc(db, 'user_mappings', formattedOld));
    if (!oldMappingDoc.exists()) throw new Error('Old phone mapping not found.');
    const mappingData = oldMappingDoc.data();

    // 3. Create NEW mapping
    await setDoc(doc(db, 'user_mappings', formattedNew), {
      ...mappingData,
      createdAt: mappingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 4. Update the actual User Record (check all possible collections)
    const collections = ['admins', 'users', 'pending_users'];
    for (const coll of collections) {
      const userRef = doc(db, coll, uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, { phone: formattedNew }, { merge: true });
      }
    }

    // 5. Delete OLD mapping
    await deleteDoc(doc(db, 'user_mappings', formattedOld));
    
    return true;
  };

  const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const setupRecaptcha = (containerId) => {
    // Clear any old verifier to avoid stale element errors
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: (response) => {
        // reCAPTCHA solved
      }
    });
    
    return window.recaptchaVerifier;
  };

  const loginWithPhone = (phoneNumber, appVerifier) => {
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  };

  const forceAdmin = () => {
    setIsAdmin(true);
    setIsSuperAdmin(true);
  };

  const value = {
    currentUser,
    isAdmin,
    isSuperAdmin,
    isSamajAdmin,
    isEduAdmin,
    userStatus,
    forceAdmin,
    loginWithEmail,
    registerWithEmail,
    loginWithPhone,
    setupRecaptcha,
    logout,
    unifiedLogin,
    unifiedRegister,
    changeMobileNumber,
    resetPasswordByEmail,
    updateUserPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
