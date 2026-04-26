import os

path = r'e:\My Website\MMP Website CWC\main CWC\src\components\SamajJogSandesh.jsx'

with open(path, 'rb') as f:
    content_bytes = f.read()

# The file was likely saved as UTF-8 but the Gujarati characters were 
# already double-encoded or mangled by PowerShell.
# Let's try to decode as UTF-8 first.
try:
    content = content_bytes.decode('utf-8')
    # If it decoded, the "junk" is now in the string.
    # We need to convert the junk string back to bytes using latin-1 
    # (which maps 0-255 characters to 0-255 bytes) and then re-decode as utf-8.
    repaired = content.encode('latin-1').decode('utf-8')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(repaired)
    print("File repaired successfully using Latin-1 to UTF-8 conversion.")
except Exception as e:
    print(f"Repair failed: {e}")
    # If it fails, I'll try to find another way.
