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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // HARDCODED SUPER ADMIN CHECK (Bypass for owner)
        const superAdmins = [
          'XffUUnZK0Qgq9Cu2O6tnEzkR0Xm1', 
          'QbW2LoICVVRzNagH5muClrivaSB3',
          'Wio99wnWmTgqaFeNB7slegaHshg2'
        ];
        
        const superEmails = ['pradeepparmar902@gmail.com'];
        const superPhones = ['+919876543210', '+919819984437', '+910000000000']; 

        // Check if user is logged in via our virtual mobile email
        const isVirtualMobile = user.email?.endsWith('@mmp-cwc.admin');
        const extractedPhone = isVirtualMobile ? `+${user.email.split('@')[0]}` : null;

        if (
          superAdmins.includes(user.uid) || 
          superEmails.includes(user.email?.toLowerCase()) ||
          superPhones.includes(user.phoneNumber) ||
          (extractedPhone && superPhones.includes(extractedPhone))
        ) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        try {
          // Check Firestore admins collection using user.uid
          const adminDocRef = doc(db, 'admins', user.uid);
          const adminDoc = await getDoc(adminDocRef);
          
          if (adminDoc.exists()) {
            setIsAdmin(true);
          } else {
            console.warn(`User ${user.uid} is logged in, but not found in the 'admins' Firestore collection.`);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
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

  const unifiedRegister = async (email, phone, password) => {
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

    // 4. Save mapping in Firestore
    await setDoc(doc(db, 'user_mappings', formattedPhone), {
      email: finalEmail,
      realEmail: email || null,
      uid: user.uid,
      createdAt: new Date().toISOString()
    });

    return userCredential;
  };

  const resetPasswordByEmail = (email) => sendPasswordResetEmail(auth, email);

  const updateUserPassword = (newPassword) => {
    if (!auth.currentUser) throw new Error("No user logged in.");
    return updatePassword(auth.currentUser, newPassword);
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
      size: 'normal',
      callback: (response) => {
        // reCAPTCHA solved
      }
    });
    
    return window.recaptchaVerifier;
  };

  const loginWithPhone = (phoneNumber, appVerifier) => {
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  };

  const forceAdmin = () => setIsAdmin(true);

  const value = {
    currentUser,
    isAdmin,
    forceAdmin,
    loginWithEmail,
    registerWithEmail,
    loginWithPhone,
    setupRecaptcha,
    logout,
    unifiedLogin,
    unifiedRegister,
    resetPasswordByEmail,
    updateUserPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
