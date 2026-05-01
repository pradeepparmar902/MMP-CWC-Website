import React, { useRef, useEffect } from 'react';
import { getDirectUrl } from '../utils/assetUtils';
import './Banner.css';

export default function Banner({ config, isSticky, isCollapsed }) {
  const bannerRef = useRef(null);
  const hasImages = config.elements?.some(el => el.url);
  const bannerHeight = hasImages ? `${config.bannerHeight}px` : '40px';

  // 📏 Dynamic Scaling Logic: Fit any banner to any screen width
  useEffect(() => {
    const updateScale = () => {
      if (!bannerRef.current) return;
      const containerWidth = bannerRef.current.offsetWidth;
      const referenceWidth = 1200; // The width the banner was designed for
      
      if (containerWidth < referenceWidth) {
        const newScale = containerWidth / referenceWidth;
        bannerRef.current.style.setProperty('--banner-scale', newScale);
      } else {
        bannerRef.current.style.setProperty('--banner-scale', '1');
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [config]);

  return (
    <section 
      ref={bannerRef}
      className={`banner-canvas ${isSticky ? 'banner-sticky' : ''} ${isCollapsed ? 'collapsed' : ''}`} 
      style={{ 
        height: isCollapsed ? '0px' : `calc(${bannerHeight} * var(--banner-scale, 1))`, 
        backgroundColor: config.bannerBgColor 
      }}
    >
      <div className="canvas-container">
        {config.elements.map((el) => {
          if (!el.url) return null;
          
          return (
            <div 
              key={el.id} 
              className="canvas-element"
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `calc(${el.width}px * var(--banner-scale, 1))`,
                height: `calc(${el.height}px * var(--banner-scale, 1))`,
                transform: `scale(${el.scale})`,
                zIndex: 10 + parseInt(el.id || 0)
              }}
            >
              <img 
                src={getDirectUrl(el.url)} 
                alt={el.name} 
                className="canvas-img"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain' 
                }} 
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
