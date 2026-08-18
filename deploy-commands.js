/*
Slash commands only need to be registered once, and updated when the definition (description, options etc) is changed. 
As there is a daily limit on command creations, it's not necessary nor desirable to connect a whole client to the 
gateway or do this on every ready event. As such, a standalone script using the lighter REST manager is preferred.

This script is intended to be run separately, only when you need to make changes to your slash command 
definitions - you're free to modify parts such as the execute function as much as you like without redeployment.
*/

const { REST, Routes } = require('discord.js');
require('dotenv/config');

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
const commands = require('./load-commands').map(command => command.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();