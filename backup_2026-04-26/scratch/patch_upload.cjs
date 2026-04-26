const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let lines = fs.readFileSync(path, 'utf8').split('\n');

// Replace lines 1032 to 1047 (1-indexed, so 1031 to 1046 in 0-indexed array)
const newHandler = `                      <input type="file" accept="image/*,video/mp4,application/pdf" style={{marginTop: '10px'}} onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const result = reader.result;
                            if (file.type && file.type.startsWith("video/")) { 
                              setFormData({...formData, videoUrl: result, type: "video"}); 
                            } else if (file.type === "application/pdf") { 
                              setFormData({...formData, bannerUrl: result, type: "letter"}); 
                            } else { 
                              try { 
                                const compressed = await compressImage(result); 
                                setFormData({...formData, bannerUrl: compressed}); 
                              } catch (err) { 
                                setFormData({...formData, bannerUrl: result}); 
                              } 
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />`;

lines.splice(1031, 16, newHandler);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log("Upload handler updated via line replacement.");
