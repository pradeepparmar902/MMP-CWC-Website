const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

try {
    // Read the file as binary (buffer)
    const buffer = fs.readFileSync(path);
    
    // The file was likely saved as UTF-8 by PowerShell, but the content 
    // was already mangled into Latin-1 looking strings.
    // Let's decode it as UTF-8 first to get the "junk" string.
    const junkString = buffer.toString('utf8');
    
    // Now convert the junk string back to bytes using Latin-1 encoding,
    // then re-decode as UTF-8 to get the original Gujarati.
    const repairedBuffer = Buffer.from(junkString, 'latin1');
    const repairedString = repairedBuffer.toString('utf8');
    
    fs.writeFileSync(path, repairedString, 'utf8');
    console.log("File repaired successfully using Node.js Latin-1 to UTF-8 conversion.");
} catch (err) {
    console.error("Repair failed:", err);
}
