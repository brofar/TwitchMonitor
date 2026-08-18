/* General */
const fs = require('node:fs');
const path = require('node:path');

// Every command module in ./commands. Files prefixed with '_' are shared helpers,
// not commands.
const commandsPath = path.join(__dirname, 'commands');
const commands = [];

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && !f.startsWith('_'))) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    commands.push(command);
  } else {
    console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
  }
}

module.exports = commands;
