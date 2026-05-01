import React, { useState, useEffect } from 'react';
import './SplashAnimation.css';

const SplashAnimation = ({ isReady }) => {
  const [phase, setPhase] = useState('initial'); // 'initial' -> 'doors-open' -> 'logo-show' -> 'fade-out' -> 'hidden'

  useEffect(() => {
    // Only start the animation sequence when the main app says it is ready
    if (!isReady) return;

    // Phase 1: Wait a tiny bit, then open the doors
    const t1 = setTimeout(() => {
      setPhase('doors-open');
    }, 300);

    // Phase 2: Logo scales up and glows
    const t2 = setTimeout(() => {
      setPhase('logo-show');
    }, 1200);

    // Phase 3: Fade out the entire splash screen
    const t3 = setTimeout(() => {
      setPhase('fade-out');
    }, 3000);

    // Phase 4: completely unmount/hide
    const t4 = setTimeout(() => {
      setPhase('hidden');
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isReady]);

  if (phase === 'hidden') return null;

  return (
    <div className={`splash-overlay phase-${phase}`}>
      {/* The background that fades out at the very end */}
      <div className="splash-bg"></div>

      {/* The Two Doors */}
      <div className="splash-door door-left"></div>
      <div className="splash-door door-right"></div>

      {/* The Logo */}
      <div className="splash-logo-container">
        <img src="/logo.png" alt="MMP Logo" className="splash-logo" />
      </div>
    </div>
  );
};

export default SplashAnimation;
