import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  RecaptchaVerifier, 
  signInWithPhoneNumber 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
          'QbW2LoICVVRzNagH5muClrivaSB3'
        ];
        
        const superEmails = ['pradeepparmar902@gmail.com'];
        
        if (superAdmins.includes(user.uid) || superEmails.includes(user.email?.toLowerCase())) {
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

  const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const setupRecaptcha = (containerId) => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        }
      });
    }
    return window.recaptchaVerifier;
  };

  const loginWithPhone = (phoneNumber, appVerifier) => {
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  };

  const value = {
    currentUser,
    isAdmin,
    loginWithEmail,
    registerWithEmail,
    loginWithPhone,
    setupRecaptcha,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
