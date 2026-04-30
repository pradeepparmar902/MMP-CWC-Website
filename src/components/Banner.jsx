import { getDirectUrl } from '../utils/assetUtils';
import './Banner.css';

export default function Banner({ config, isSticky, isCollapsed }) {
  const hasImages = config.elements?.some(el => el.url);
  const bannerHeight = hasImages ? `${config.bannerHeight}px` : '40px';

  return (
    <section 
      className={`banner-canvas ${isSticky ? 'banner-sticky' : ''} ${isCollapsed ? 'collapsed' : ''}`} 
      style={{ 
        height: isCollapsed ? '0px' : bannerHeight, 
        backgroundColor: config.bannerBgColor 
      }}
    >
      <div className="canvas-container">
        {config.elements.map((el) => {
          if (!el.url) return null;
          
          const validElements = config.elements.filter(e => e.url);
          const isCenter = el.id === '2' || validElements.length === 1 || (el.name && el.name.toLowerCase().includes('center'));

          return (
            <div 
              key={el.id} 
              className={`canvas-element ${isCenter ? 'center-logo' : 'side-logo'}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}px`,
                height: `${el.height}px`,
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
