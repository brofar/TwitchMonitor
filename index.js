const axios = require('axios');
const fs = require('fs');
const Dotenv = require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();
client.commands = new Discord.Collection();

const DiscordChannelSync = require("./discord-channel-sync");
const LiveEmbed = require('./live-embed');
const MiniDb = require('./minidb');
const TwitchMonitor = require('./twitch-monitor');
const DiscordGuild = require('./discord-guild');
const logger = require('./logger');


// --- Startup -------------------------------------------
logger.log('Bot starting.');

// --- Discord Commands ----------------------------------
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

logger.log(`[Discord]`, `Discovered ${commandFiles.length} command file(s).`);

// grab all the command files from the command directory
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);

  // set a new item in the Collection
  // with the key as the command name and the value as the exported module
  var cmdName = command.name.toString().trim().toLowerCase();
  client.commands.set(cmdName, command);
  logger.log(`[Discord]`, `Added ${cmdName} to active command list.`);
}
logger.log(`[Discord]`, `Finished loading commands.`);

// --- Discord -------------------------------------------
logger.log(`[Discord]`, `Connecting to Discord...`);

let targetChannels = [];

let syncServerList = (logMembership) => {
  targetChannels = DiscordChannelSync.getChannelList(client, logMembership);
};

// Connected to Discord
client.on('ready', () => {
  logger.log('[Discord]', `Bot is ready; logged in as ${client.user.tag}.`);

  // Init list of connected servers, and determine which channels we are announcing to
  syncServerList(true);

  // Keep our activity in the user list in sync
  StreamActivity.init(client);

  // Begin Twitch API polling
  TwitchMonitor.start();

  // Clean orphan messages
  CleanDiscordHistory();
});


// When client gets an error, it logs out
// Need to log back in so we can continue
client.on('error', err => {
  logger.error('[Discord]', 'Error encountered. Logging back in.');
  logger.error(err);
  client.login(process.env.DISCORD_BOT_TOKEN);
});

// Added to a new server
client.on("guildCreate", guild => {
  logger.log(`[Discord]`, `[${guild.name}]`, `Joined new server: ${guild.name}`);

  // Create guild object.
  let _ = new DiscordGuild(guild);
  logger.log(`[Discord]`, `[${guild.name}]`, `Created configuration for ${guild.name}`);

  syncServerList(false);
});

// Removed from a server
client.on("guildDelete", guild => {
  logger.log(`[Discord]`, `Removed from a server: ${guild.name}`);

  let dGuild = new DiscordGuild(guild);
  dGuild.remove();
  logger.log(`[Discord]`, `[${guild.name}]`, `Deleted configuration for ${guild.name}`);

  syncServerList(false);
});

client.on("reconnecting", message => {
    logger.warn(`[Discord]`, `Bot reconnecting`);
});

client.on("resume", message => {
    logger.warn(`[Discord]`, `Bot reconnected as ${client.user.tag}`);
});
client.on("disconnect", message => {
    logger.error(`[Discord]`, `Bot disconnected. Attempting to reconnect.`);
    client.login(process.env.DISCORD_BOT_TOKEN);
});

// Message / Command parsing
client.on('message', message => {
  // Empty or bot message
  if (!message.content || message.author.bot) return;

  let txtPlain = message.content.toString().trim();
  let txtLower = txtPlain.toLowerCase();

  // Whitespace or blank message
  if (!txtLower.length) return;

  // Get the guild in which the message was sent
  let theGuild = new DiscordGuild(message.guild);

  let prefix = theGuild.get("discordPrefix");

  // Not a command
  if (txtLower.charAt(0) !== prefix) return;

  let now = Date.now();

  // Only admins can run commands
  if (message.member.hasPermission("ADMINISTRATOR")) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    logger.log(`[Discord]`, `[${message.guild.name}]`, `${command} command received from @${message.member.displayName}. Command Exists: ${client.commands.has(command)}`);

    if (!client.commands.has(command)) return;

    // Run the actual command
    try {
      client.commands.get(command).execute(message, args, theGuild);
    } catch (e) {
      logger.warn('[Discord]', 'Command execution problem:', e);
      message.reply('There was an error trying to execute that command!');
    }
  }
});

logger.log('[Discord]', 'Logging in...');
client.login(process.env.DISCORD_BOT_TOKEN);


// Activity updater
class StreamActivity {
  /**
   * Registers a channel that has come online, and updates the user activity.
   */
  static setChannelOnline(stream) {
    this.onlineChannels[stream.user_name] = stream;

    //this.updateActivity();
  }

  /**
   * Marks a channel has having gone offline, and updates the user activity if needed.
   */
  static setChannelOffline(stream) {
    delete this.onlineChannels[stream.user_name];

    //this.updateActivity();
  }

  /**
   * Updates the user activity on Discord.
   * Either clears the activity if no channels are online, or sets it to "watching" if a stream is up.
   */
  static updateActivity() {
    let numStreams = Object.keys(this.onlineChannels).length;
    let activity = `${numStreams} stream${numStreams == 1 ? "" : "s"}`;
    this.discordClient.user.setActivity(activity, {
      "type": "WATCHING"
    });

    logger.log('[StreamActivity]', `Update current activity: watching ${activity}.`);
  }

  static init(discordClient) {
    this.discordClient = discordClient;
    this.onlineChannels = {};

    this.updateActivity();

    // Continue to update current stream activity every 5 minutes or so
    // We need to do this b/c Discord sometimes refuses to update for some reason
    // ...maybe this will help, hopefully
    setInterval(this.updateActivity.bind(this), 5 * 60 * 1000);
  }
}

// --- Live events -------------------------------------------

let liveMessageDb = new MiniDb('live-messages');
let messageHistory = liveMessageDb.get("history") || {};

function CleanDiscordHistory() {
  logger.log('[CleanDiscordHistory]', `Cleaning all posts.`);

  for (const liveMsgDiscrim in messageHistory) {
    let [guild, channel, twitch] = liveMsgDiscrim.split('_');
    let dChannel = DiscordChannelSync.getChannel(client, guild, channel, false);
    let messageId = messageHistory[liveMsgDiscrim];

    if (!dChannel) continue;

    dChannel.messages.fetch(messageId)
      .then((existingMsg) => {
        // Delete the message from discord
        existingMsg.delete();

        // Clean up DB
        delete messageHistory[liveMsgDiscrim];
        liveMessageDb.put('history', messageHistory);
      })
      .catch((e) => {
        // Unable to retrieve message object
        if (e.message === "Unknown Message") {
          // Specific error: the message does not exist, most likely deleted.
          delete messageHistory[liveMsgDiscrim];
          liveMessageDb.put('history', messageHistory);
        }
      });
  }
  logger.log('[CleanDiscordHistory]', `Cleaned all posts.`);
}

// Periodically update channel list & status
setTimeout(discordMaintenance, 60000);

function discordMaintenance() {
  logger.log('Performing periodic discord update functions.');
  syncServerList(false);
  StreamActivity.updateActivity();
}

TwitchMonitor.onChannelLiveUpdate((streamData) => {
  const isLive = (streamData.type === "live");

  logger.log(`Client Status: ${client.ws.status}`)

  // Update activity
  StreamActivity.setChannelOnline(streamData);

  // Generate message
  const msgFormatted = `${streamData.user_name} went live on Twitch!`;
  const msgEmbed = LiveEmbed.createForStream(streamData);

  // Broadcast to all target channels
  let anySent = false;

  for (let i = 0; i < targetChannels.length; i++) {
    const discordChannel = targetChannels[i];

    const liveMsgDiscrim = `${discordChannel.guild.id}_${discordChannel.id}_${streamData.user_name.toLowerCase()}`;

    if (discordChannel) {
      try {
        // Either send a new message, or update an old one
        let existingMsgId = messageHistory[liveMsgDiscrim] || null;

        let watchedStreamer = discordChannel['watch-list'].includes(streamData.user_name.toLowerCase());

        // If liveMsgDiscrim exists but streamData.user_name is NOT in channel's list:
        // delete the message, because the streamer was removed by someone.
        if (existingMsgId && !watchedStreamer) { // Streamer recently removed from list
          // Fetch existing message
          discordChannel.messages.fetch(existingMsgId)
            .then((existingMsg) => {
              // Delete the message from discord
              existingMsg.delete();

              // Clean up DB
              delete messageHistory[liveMsgDiscrim];
              liveMessageDb.put('history', messageHistory);

              logger.log('[Twitch]', `${streamData.user_name} was removed from ${discordChannel.guild.name} #${discordChannel.name}.`);
            })
            .catch((e) => {
              logger.warn('[Twitch]', `Could not remove ${streamData.user_name} from ${discordChannel.guild.name} #${discordChannel.name}.`);
            });
        } else if (!watchedStreamer) {
          // Not a streamer this guild cares about.
          continue;
        } else if (existingMsgId) {
          // Message already exists
          // Fetch existing message
          discordChannel.messages.fetch(existingMsgId)
            .then((existingMsg) => {
              // Clean up entry if no longer live
              if (!isLive) {
                logger.log('[Twitch]', `${streamData.user_name} went offline.`);

                // Delete the message from discord
                existingMsg.delete().catch((e) => {
                  logger.warn('[Discord]', `Delete Error: ${e.message}.`);
                });

                // Clean up DB
                delete messageHistory[liveMsgDiscrim];
                liveMessageDb.put('history', messageHistory);
              } else {
                // https://discordjs.guide/popular-topics/errors.html#path
                existingMsg.edit(msgFormatted, { embed: msgEmbed }).catch((e) => {
                  logger.warn('[Discord]', `Edit Error: ${e.message}.`);
                });
              }
            })
            .catch((e) => {
              // Unable to retrieve message object for editing
              if (e.message === "Unknown Message") {
                // Specific error: the message does not exist, most likely deleted.
                logger.warn('[Discord]', `The message for ${liveMsgDiscrim} does not exist, most likely deleted.`);

                delete messageHistory[liveMsgDiscrim];
                liveMessageDb.put('history', messageHistory);
                // This will cause the message to be posted as new in the next update if needed.
              } else {
                logger.warn('[Discord]', `Error: ${e.message}.`);
              }
            });
        } else { // New message needed
          // Sending a new message
          if (!isLive) {
            // We do not post "new" notifications for channels going/being offline
            continue;
          }

          let msgToSend = msgFormatted;
          if (process.env.TEST_MODE != true) {
            let msgOptions = {
              embed: msgEmbed
            };

            discordChannel.send(msgToSend, msgOptions)
              .then((message) => {
                logger.log('[Discord]', `Sent announce msg to #${discordChannel.name} on ${discordChannel.guild.name} for ${streamData.user_name}: ${message}`)

                messageHistory[liveMsgDiscrim] = message.id;
                liveMessageDb.put('history', messageHistory);
              })
              .catch((err) => {
                logger.log('[Discord]', `Could not send announce msg to #${discordChannel.name} on ${discordChannel.guild.name} for ${streamData.user_name}:`, err.message);
              });
          } else {
            logger.log('[Discord]', `[${discordChannel.guild.name}]`, `[${discordChannel.name}]`, `${msgFormatted}`);
          }
        }

        anySent = true;
      } catch (e) {
        logger.warn('[Discord]', 'Message send problem:', e);
      }
    }
  }

  liveMessageDb.put('history', messageHistory);
  return anySent;
});

TwitchMonitor.onChannelOffline((streamData) => {
  // Update activity
  StreamActivity.setChannelOffline(streamData);
});