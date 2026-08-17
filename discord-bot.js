/* General */
const Discord = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const moment = require('moment');
const humanizeDuration = require("humanize-duration");

/* Local */
const log = require('./log');
const db = require('./db');


const className = '[Discord]';

class bot {
  async init() {
    // Initialize the DB.
    await db.Init();

    this.client = new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
      ],
    });

    this.client.commands = new Discord.Collection();

    // Grab all the command folders from the commands directory
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        this.client.commands.set(command.data.name, command);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }

    // alias for ease of use
    let client = this.client;

    // Resolved once the first-run orphan cleanup finishes, so init() can block
    // the Twitch poller from racing a fresh SendLiveMessage against the scan.
    let resolveFirstCleanup;
    const firstCleanup = new Promise(resolve => { resolveFirstCleanup = resolve; });

    // ClientReady can fire more than once (the error/ShardDisconnect handlers
    // below re-login on reconnect). Only run the orphan scan on the very first
    // ready - running it again later would race against the live Twitch poller.
    let cleanupStarted = false;

    // Discord bot connected
    client.on(Discord.Events.ClientReady, async () => {
      log.log(className, `Bot logged in as ${client.user.tag}.`);
      if (cleanupStarted) return;
      cleanupStarted = true;
      await this.CleanupOrphanedMessages();
      resolveFirstCleanup();
    });

    // Discord bot added to a server
    client.on(Discord.Events.GuildCreate, async guild => {
      log.log(className, `[${guild.name}]`, `Bot joined a new server: ${guild.name}`);
    });

    // Discord bot removed from a server
    client.on(Discord.Events.GuildDelete, async guild => {
      await db.KillGuild(guild.id);
      log.log(className, `Removed from a server: ${guild.name}`);
    });

    // Discord bot has an error
    client.on(Discord.Events.Error, err => {
      log.error(className, 'Error encountered. Logging back in.');
      log.error(err);
      client.login(process.env.DISCORD_BOT_TOKEN);
    });

    // Discord bot disconnected
    client.on(Discord.Events.ShardDisconnect, message => {
      log.error(className, `Bot disconnected. Attempting to reconnect.`);
      client.login(process.env.DISCORD_BOT_TOKEN);
    });

    // Discord sees a message
    client.on(Discord.Events.InteractionCreate, async interaction => {
      // If the sender isn't an admin, ignore.
      if (!interaction.member.permissions.has("MANAGE_GUILD") && !interaction.member.permissions.has("ADMINISTRATOR")) return;
      if (typeof interaction.guild.id === 'undefined') return;

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(className, `No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: Discord.MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: Discord.MessageFlags.Ephemeral });
        }
      }

    });

    // Now that all the event handlers are declared, actually log in.
    log.log(className, 'Logging in to Discord.');
    await client.login(process.env.DISCORD_BOT_TOKEN);

    // Wait for the startup orphan cleanup to fully finish before returning control.
    // Otherwise the Twitch poller's first refresh could send a live message that
    // the still-running scan then deletes, mistaking it for an untracked orphan.
    await firstCleanup;
  }

  /**
   * One-time startup reconciliation: delete any of the bot's own messages in its
   * configured announcement channels that have no matching `livemessages` row.
   * Catches messages orphaned by a crash between channel.send() and db.AddMessage(),
   * or by manual DB edits. Runs once on the first ClientReady only, to keep Discord
   * API usage down.
   */
  async CleanupOrphanedMessages() {
    const channels = await db.GetMonitoredChannels();
    const trackedMessages = await db.GetMessages();
    const trackedIds = new Set(trackedMessages.map(m => m.messageid));

    for (const { guildid, channelid } of channels) {
      const channel = await this.GetChannel(guildid, channelid);
      if (!channel) continue;

      let recentMessages;
      try {
        recentMessages = await channel.messages.fetch({ limit: 100 });
      } catch (e) {
        log.warn(className, '[CleanupOrphanedMessages]', `Failed to fetch messages for #${channel.name} in ${channel.guild.name}: ${e.message}.`);
        continue;
      }

      const orphans = recentMessages.filter(m => m.author.id === this.client.user.id && !trackedIds.has(m.id));

      for (const orphan of orphans.values()) {
        try {
          await orphan.delete();
          log.log(className, '[CleanupOrphanedMessages]', `Deleted orphaned message in #${channel.name} (${channel.guild.name}).`);
        } catch (e) {
          log.warn(className, '[CleanupOrphanedMessages]', `Failed to delete orphaned message ${orphan.id}: ${e.message}.`);
        }
      }
    }
  }

  /**
   * Console command: list the servers the bot is currently in.
   */
  ListGuilds() {
    const guilds = [...this.client.guilds.cache.values()];
    log.log(className, `In ${guilds.length} server${guilds.length == 1 ? "" : "s"}:`);
    for (const guild of guilds) {
      log.log(className, `${guild.id}  ${guild.name} (${guild.memberCount} members)`);
    }
  }

  /**
   * Console command: offboard a server - delete its live messages, leave it, and
   * drop its config. The GuildDelete handler also calls KillGuild; it's idempotent.
   *
   * @param {string} guildId  Guild ID
   */
  async LeaveGuild(guildId) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      log.warn(className, `[LeaveGuild]`, `Not in a server with ID ${guildId}.`);
      return;
    }

    const messages = await db.GetMessages();
    await this.DeleteMessages(messages.filter(m => m.guildid === guildId));

    await guild.leave();
    await db.KillGuild(guildId);
    log.log(className, `[LeaveGuild]`, `Left ${guild.name} (${guildId}) and removed its config.`);
  }

  /**
   * Updates the discord bot's activity to "Watching x stream(s)"
   * 
   * @param {number} numStreams  Number of streams the bot is watching.
   *
   */
  UpdateWatchStatus(numStreams) {
    let activity = `${numStreams} stream${numStreams == 1 ? "" : "s"}`;
    this.client.user.setActivity(activity, {
      "type": Discord.ActivityType.Watching
    });

    log.log(className, '[UpdateWatchStatus]', `Updated current activity: Watching ${activity}.`);
  }

  /**
   * The main function of the bot. Shows cards for each active streamer. Deletes non-live ones.
   * 
   * @param {object[]} streams  Streamer objects in an array
   *
   */
  async ProcessStreams(streams) {
    // Grab all live messages from db
    let messages = await db.GetMessages();

    // Grab the monitor list for these streamers
    let streamerNames = streams.map(a => a.user_login);
    let monitorList = (streamerNames.length > 0) ? await db.GetGuildsPerStreamer(streamerNames) : [];

    //***** 1. Cleanup Stage *****/
    // Streamers in discord messages but no longer live (messages to be deleted)
    let offlineStreamers = messages.filter(element => !streamerNames.includes(element.streamer));

    // Streamers deleted from a guild's watch list.
    let deletedStreamers = messages.filter(element => monitorList.findIndex(e => element.streamer == e.streamer && element.guildid == e.guildid) === -1);

    // A streamer can match both filters above (e.g. offline AND no longer watched),
    // so dedupe to avoid processing/deleting the same Discord message twice.
    const seenMessages = new Set();
    let messagesToDelete = [...offlineStreamers, ...deletedStreamers].filter(m => {
      const key = `${m.guildid}:${m.channelid}:${m.messageid}`;
      if (seenMessages.has(key)) return false;
      seenMessages.add(key);
      return true;
    });
    this.DeleteMessages(messagesToDelete);

    //***** 2. Announcing Stage *****/
    for (const stream of streams) {
      const streamerFilter = (element) => element.streamer == stream.user_login;

      // List of {guildid, channelid} watching this streamer
      let guildChannels = monitorList.filter(streamerFilter);

      for (const { guildid, channelid, roleid } of guildChannels) {
        let messageIdx = messages.findIndex(
          element =>
            element.streamer == stream.user_login &&
            element.guildid == guildid &&
            element.channelid == channelid
        );
        if (messageIdx !== -1) {
          // Update existing message
          let theMessage = messages[messageIdx];
          this.UpdateMessage(guildid, channelid, theMessage.messageid, roleid, stream);
        } else {
          // Create a new message
          this.SendLiveMessage(guildid, channelid, roleid, stream);
        }
      }
    }
  }

  /**
   * Delete discord messages and remove from db
   * 
   * @param {int} messages    Messages array
   *
   */
  async DeleteMessages(messages) {
    for (const message of messages) {
      // Remove from Discord
      let discordDeleteSuccess = false;
      try {
        await this.DeleteMessage(message.guildid, message.channelid, message.messageid);
        discordDeleteSuccess = true;
      } catch (err) {
        log.error(className, `[DeleteMessages] Error deleting Discord message:`, err);

        // Remove from DB if error is unrecoverable
        const unrecoverableErrors = [
          Discord.RESTJSONErrorCodes.UnknownMessage, // message deleted
          Discord.RESTJSONErrorCodes.MissingAccess,  // bot removed from server or channel
          Discord.RESTJSONErrorCodes.MissingPermissions
        ];
        if (err && err.code && unrecoverableErrors.includes(err.code)) {
          discordDeleteSuccess = true;
        }
      }

      // Remove from DB only if discord delete succeeded or error is unrecoverable
      if (discordDeleteSuccess) {
        try {
          await db.DeleteMessage(message.guildid, message.messageid);
          const guildName = this.client.guilds.cache.get(message.guildid)?.name ?? message.guildid;
          log.log(className, `[DeleteMessages] Deleted DB reference for ${message.streamer} in guild ${guildName}.`);
        } catch (err) {
          log.error(className, `[DeleteMessages] Error deleting message from DB:`, err);
        }
      }
    }
  }

  /**
   * Delete a discord message
   * 
   * @param {int} guildId    Guild ID
   * @param {int} channelId  Channel ID
   * @param {int} messageId  Message ID
   *
   */
  async DeleteMessage(guildId, channelId, messageId) {
    let channel = await this.GetChannel(guildId, channelId);
    if (!channel) return;

    // force: true avoids treating a stale cached message as still present on Discord
    const existingMsg = await channel.messages.fetch({ message: messageId, force: true });
    await existingMsg.delete();
    const guildName = existingMsg.guild?.name ?? existingMsg.guild.id;
    log.log(className, `Deleted message from ${guildName}.`);
  }

  /**
   * Get a discord channel object
   */
  async GetChannel(guildId, channelId) {
    let guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;
    let channel = guild.channels.cache.get(channelId);
    return channel;
  }

  /**
   * Create a discord message
   */
  async SendLiveMessage(guildId, channelId, roleid, streamer) {
    let channel = await this.GetChannel(guildId, channelId);
    if (!channel) return;
    let msgContent = this.CreateMessage(streamer);

    // If a role is specified, mention it in the message
    let messageText = null;
    if (roleid) {
      messageText = `<@&${roleid}> ${streamer.user_name} is live!`;
    }

    channel.send({ content: messageText, embeds: [msgContent] })
      .then(async (message) => {
        await db.AddMessage(guildId, channelId, message.id, streamer.user_login);
        log.log(className, '[SendLiveMessage]', `[${streamer.user_name}]`, `Sent to #${channel.name} in ${channel.guild.name} | Viewers: ${streamer.viewer_count} | Category ${streamer.game_name} | Title: ${streamer.title}`);
      })
      .catch((e) => {
        log.warn(className, '[SendLiveMessage]', `Send error for ${streamer.user_name} in ${channel.guild.name}: ${e.code} // ${e.message}.`);
        log.error(className, e);
      });
  }

  /**
   * Edit a discord message
   */
  async UpdateMessage(guildId, channelId, messageId, roleid, streamer) {
    let channel = await this.GetChannel(guildId, channelId);
    if (!channel) return;
    let msgContent = this.CreateMessage(streamer);

    // If a role is specified, mention it in the message
    let messageText = null;
    if (roleid) {
      messageText = `<@&${roleid}> ${streamer.user_name} is live!`;
    }

    // force: true avoids treating a stale cached message as still present on Discord
    channel.messages.fetch({ message: messageId, force: true })
      .then((message) => {
        message.edit({ embeds: [msgContent] })
          .then((message) => {
            log.log(className, '[UpdateMessage]', `[${streamer.user_name}]`, `Updated #${channel.name} in ${channel.guild.name} | Viewers: ${streamer.viewer_count} | Category ${streamer.game_name}`);
          })
          .catch(async (e) => {
            if (e.code === 10003 /* Unknown Channel */ || e.code === 10008 /* Unknown Message */ || e.code === 10004 /* Unknown Guild */) {
              await db.DeleteMessage(guildId, messageId);
              log.log(className, '[UpdateMessage]', `Deleted message from DB due to error.`);
              return;
            }
            log.warn(className, '[UpdateMessage]', `Edit error for ${streamer.user_name} in ${channel.guild.name}: ${e.message}.`);
          });
      })
      .catch(async (e) => {
        // Unable to retrieve message object
        if (e.code === 10003 /* Unknown Channel */ || e.code === 10008 /* Unknown Message */ || e.code === 10004 /* Unknown Guild */) {
          // Delete the message from the DB so a new one is created next time.
          db.DeleteMessage(guildId, messageId)
            .then(() => log.log(className, '[UpdateMessage]', `Deleted message from DB due to error.`));
          return;
        } else {
          // Some other error, log it.
          log.error(className, '[UpdateMessage]', `Error fetching/updating Discord message ${messageId} in ${channel.guild.name}: ${e.message}.`);
        }
      });
  }

  /**
   * 
   * @param {int} guildId    Guild ID
   *
   */
  CreateMessage(streamer) {
    // Thumbnail
    let thumbUrl = streamer.profile_image_url;

    let msgEmbed = new Discord.EmbedBuilder()
      .setColor("#9146ff")
      .setURL(`https://twitch.tv/${streamer.user_name.toLowerCase()}`)
      .setThumbnail(thumbUrl)
      .setTitle(`:red_circle: **${streamer.user_name} is live on Twitch!**`)
      .addFields(
        { name: "Title", value: streamer.title, inline: false }
      );

    // Add Category if available
    if (streamer.game_name) {
      msgEmbed.addFields({ name: "Category", value: streamer.game_name, inline: false });
    }

    // Add status
    msgEmbed.addFields({ name: "Status", value: `Live with ${streamer.viewer_count} viewers`, inline: true })

    // Set main image (stream preview)
    let imageUrl = streamer.thumbnail_url;
    imageUrl = imageUrl.replace("{width}", "480");
    imageUrl = imageUrl.replace("{height}", "270");
    let thumbnailBuster = (Date.now() / 1000).toFixed(0);
    imageUrl += `?t=${thumbnailBuster}`;
    msgEmbed.setImage(imageUrl);

    // Add uptime
    let now = moment();
    let startedAt = moment(streamer.started_at);

    msgEmbed.addFields({
      name: "Uptime", value: humanizeDuration(now - startedAt, {
        delimiter: ", ",
        largest: 2,
        round: true,
        units: ["y", "mo", "w", "d", "h", "m"]
      }), inline: true
    });

    return msgEmbed;
  }

}

module.exports = bot;
