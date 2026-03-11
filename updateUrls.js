const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace occurrences of hardcoded 'http://localhost:8000/api'
    // Most pages probably define API_BASE like so: const API_BASE = 'http://localhost:8000/api';
    // So we first do an exact replace:
    content = content.replace(/const API_BASE = 'http:\/\/localhost:8000\/api';/g, "const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';");

    // In some components like LiveStudio, they might hardcode it directly without API_BASE.
    // There's a chance they have "http://localhost:8000/api/..." inside template literals:
    // `${`http://localhost:8000`}/api`

    // We can just replace any 'http://localhost:8000' or "http://localhost:8000" or `http://localhost:8000`
    // with ${import.meta.env.VITE_API_URL || 'http://localhost:8000'} where appropriately inside template literals.

    // Actually simpler:
    // if we see exactly 'http://localhost:8000/api' as a standalone string (e.g. inside a fetch) not covered by API_BASE:
    content = content.replace(/'http:\/\/localhost:8000/g, "(import.meta.env.VITE_API_URL || 'http://localhost:8000') + '");
    content = content.replace(/"http:\/\/localhost:8000/g, "(import.meta.env.VITE_API_URL || \"http://localhost:8000\") + \"");

    fs.writeFileSync(filePath, content);
});

console.log("Updated files to use VITE_API_URL");
