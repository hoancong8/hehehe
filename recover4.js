const fs = require('fs');
const lines = fs.readFileSync('C:/Users/admin/.gemini/antigravity-ide/brain/93019836-3af3-4fad-b606-3ed32ddf7d6c/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');

for (const line of lines) {
  if (line.trim().startsWith('{"step_index":32')) {
    const data = JSON.parse(line);
    const args = data.tool_calls[0].args;
    let content = args.CodeContent;
    
    // It's a string that literally contains escaped characters.
    if (content.startsWith('"') && content.endsWith('"')) {
        content = content.slice(1, -1);
    }
    content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    
    fs.writeFileSync('c:/Users/admin/OneDrive/Desktop/web_hp_v_2/hehehe/src/systems/SpriteSystem.js', content);
    console.log('Restored SpriteSystem.js successfully!');
    break;
  }
}
