const fs = require('fs');
let code = fs.readFileSync('c:/Users/admin/OneDrive/Desktop/web_hp_v_2/hehehe/src/systems/SpriteSystem.js', 'utf8');

if (code.startsWith('"') && code.endsWith('"')) {
    // It's a JSON-encoded string
    try {
        code = JSON.parse(code);
    } catch(e) {
        console.error("Failed to JSON parse:", e);
    }
} else if (code.includes('\\n')) {
    // Manually unescape
    code = code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

fs.writeFileSync('c:/Users/admin/OneDrive/Desktop/web_hp_v_2/hehehe/src/systems/SpriteSystem.js', code);
console.log('Fixed SpriteSystem.js!');
