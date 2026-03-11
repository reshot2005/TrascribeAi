import os
import glob

print("Running Python url replacer")
directory = r"c:\Users\surya\OneDrive\Desktop\PROJECTS\AI TRASCRIBE\src\pages"
files = glob.glob(os.path.join(directory, "*.jsx"))

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Special case for const API_BASE
    content = content.replace(
        "const API_BASE = 'http://localhost:8000/api';",
        "const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';"
    )
    content = content.replace(
        'const API_BASE = "http://localhost:8000/api";',
        "const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';"
    )
    
    # General case replacing literal starts of urls
    content = content.replace(
        "'http://localhost:8000",
        "(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8000') + '"
    )
    content = content.replace(
        '"http://localhost:8000',
        '(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/api", "") : "http://localhost:8000") + "'
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("done")
