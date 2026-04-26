const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let lines = fs.readFileSync(path, 'utf8').split('\n');

// Replace lines 806 to 835 (1-indexed, so 805 to 834 in 0-indexed array)
const newRendering = `                  {item.type === 'video' ? (
                    <div className="video-container">
                      {item.videoUrl?.includes('youtube.com') || item.videoUrl?.includes('youtu.be') ? (
                        <iframe 
                          src={'https://www.youtube.com/embed/' + (item.videoUrl.split('v=')[1] || item.videoUrl.split('/').pop())}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <video src={item.videoUrl} controls poster={item.bannerUrl} />
                      )}
                    </div>
                  ) : item.type === 'poster' ? (
                    <div className="poster-full-image">
                       <img src={item.bannerUrl} alt={getT(item, 'title')} />
                    </div>
                  ) : item.type === 'text' ? (
                    <div className="text-preview-area">
                       <div className="text-thumb">
                          <img src={item.bannerUrl || 'https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?q=80&w=200'} alt="" />
                       </div>
                    </div>
                  ) : item.type === 'letter' ? (
                    <div className="letter-preview-box">
                       <div className="letter-document-frame">
                          {item.bannerUrl ? (
                            <>
                              {item.bannerUrl.startsWith && item.bannerUrl.startsWith('data:application/pdf') ? (
                                <div className="pdf-placeholder-container">
                                  <span className="pdf-document-icon">📄</span>
                                  <span className="pdf-filename">Document.pdf</span>
                                </div>
                              ) : (
                                <img src={item.bannerUrl} className="letter-image-content" alt="Document" />
                              )}
                              <div className="letter-doc-badge">DOC</div>
                            </>
                          ) : (
                             <div className="letter-scanned-content">
                                <div className="letter-doc-header"></div>
                                <div className="letter-line"></div>
                                <div className="letter-line"></div>
                                <div className="letter-line"></div>
                             </div>
                          )}
                       </div>
                    </div>
                  ) : item.bannerUrl ? (
                    <div className="card-image">
                        <img src={item.bannerUrl} alt={item['title' + (lang === 'gu' ? 'Gu' : 'En')] || item['title' + (lang === 'gu' ? 'En' : 'Gu')] || ''} />
                    </div>
                  ) : (
                    <div className="card-text-icon">
                       <span className="media-placeholder-icon">{item.type === 'letter' ? '📜' : '📝'}</span>
                    </div>
                  )}`;

lines.splice(805, 30, newRendering);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log("Premium rendering logic restored via line splicing.");
