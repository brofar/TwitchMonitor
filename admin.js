/*
 * Standalone admin commands. Run these in a shell:
 *
 *   node admin.js servers          - list the servers the bot is in
 *   node admin.js leave <guildid>  - delete the server's live messages, leave it,
 *                                    and remove its config
 *
 * Logs in as a second session with the same token, does one thing, exits.
 */
require('dotenv').config();
const Discord = require('discord.js');

/* Local */
const Bot = require('./discord-bot');
const log = require('./log');

const className = '[admin]';
const [cmd, guildId] = process.argv.slice(2);

if (!['servers', 'leave'].includes(cmd) || (cmd === 'leave' && !guildId)) {
  console.log('Usage: node admin.js servers | node admin.js leave <guildid>');
  process.exit(1);
}

const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds] });

// Reuse the bot's guild/message helpers without calling init(), so this doesn't
// run migrations, the orphan scan, or the Twitch poller.
const bot = new Bot();
bot.client = client;

client.once(Discord.Events.ClientReady, async () => {
  try {
    if (cmd === 'servers') bot.ListGuilds();
    else await bot.LeaveGuild(guildId);
  } catch (err) {
    log.error(className, `Command '${cmd}' failed:`, err);
    process.exitCode = 1;
  }
  await client.destroy();
  process.exit(process.exitCode ?? 0);
});

client.login(process.env.DISCORD_BOT_TOKEN);
