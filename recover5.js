const fs = require('fs');
let code = fs.readFileSync('c:/Users/admin/OneDrive/Desktop/web_hp_v_2/hehehe/src/systems/SpriteSystem.js', 'utf8');

if (code.startsWith('"')) {
    code = code.substring(1);
}
if (code.endsWith('"')) {
    code = code.substring(0, code.length - 1);
}
code = code.replace(/"$/g, '');
code = code.replace(/^"/g, '');

fs.writeFileSync('c:/Users/admin/OneDrive/Desktop/web_hp_v_2/hehehe/src/systems/SpriteSystem.js', code);
console.log('Stripped quotes');
