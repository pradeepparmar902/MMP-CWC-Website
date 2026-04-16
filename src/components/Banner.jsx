import './Banner.css';

export default function Banner({ config }) {
  const hasImages = config.elements?.some(el => el.url);
  const bannerHeight = hasImages ? `${config.bannerHeight}px` : '40px';

  return (
    <section 
      className="banner-canvas" 
      style={{ 
        height: bannerHeight, 
        backgroundColor: config.bgColor 
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
                width: `${el.width}px`,
                height: `${el.height}px`,
                transform: `scale(${el.scale})`,
                zIndex: 10 + parseInt(el.id || 0)
              }}
            >
              <img 
                src={el.url} 
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
