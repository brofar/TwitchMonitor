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

    // Discord bot connected
    client.on('ready', () => {
      log.log(className, `Bot logged in as ${client.user.tag}.`);
      this.Purge();
    });

    // Discord bot added to a server
    client.on(Discord.Events.GuildCreate, async guild => {
      await db.NewGuild(guild.id);
      log.log(className, `[${guild.name}]`, `Bot joined a new server: ${guild.name}`);
    });

    // Discord bot removed from a server
    client.on(Discord.Events.GuildDelete, async guild => {
      await db.KillGuild(guild.id);
      log.log(className, `Removed from a server: ${guild.name}`);
    });

    // Discord bot has an error
    client.on('error', err => {
      log.error(className, 'Error encountered. Logging back in.');
      log.error(err);
      client.login(process.env.DISCORD_BOT_TOKEN);
    });

    // Discord bot disconnected
    client.on("disconnect", message => {
      log.error(className, `Bot disconnected. Attempting to reconnect.`);
      client.login(process.env.DISCORD_BOT_TOKEN);
    });

    // Discord sees a message
    client.on(Discord.Events.InteractionCreate, async interaction => {
      // If the sender isn't an admin, ignore.
      if (!interaction.member.permissions.has("MANAGE_CHANNELS") && !interaction.member.permissions.has("ADMINISTRATOR")) return;

      // Get the guild in which the message was sent
      let _guild = await db.GetConfig(interaction.guild.id);
      if (typeof _guild === 'undefined') return;

      // Split the message by space characters
      //const args = message.content.slice(prefix.length).trim().split(/ +/);

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
    // Grab all configs
    let configs = await db.GetAllConfigs();

    // Grab all live messages from db
    let messages = await db.GetMessages();

    // Grab the monitor list for these streamers
    let streamerNames = streams.map(a => a.user_login);
    let monitorList = (streamerNames.length > 0) ? await db.GetGuildsPerStreamer(streamerNames) : [];

    // Streamers in discord messages but no longer live (messages to be deleted)
    let offlineStreamers = messages.filter(element => !streamerNames.includes(element.streamer));

    // Streamers deleted from a guild's watch list.
    let deletedStreamers = messages.filter(element => monitorList.findIndex(e => element.streamer == e.streamer && element.guildid == e.guildid) === -1);

    let messagesToDelete = [...offlineStreamers, ...deletedStreamers];
    this.DeleteMessages(messagesToDelete);

    // Process non-deleted stuff now.
    for (const stream of streams) {
      const streamerFilter = (element) => element.streamer == stream.user_login;

      // List of guild ids watching this streamer
      let guilds = monitorList.filter(streamerFilter).map(a => a.guildid);

      for (const guild of guilds) {
        let message = messages.findIndex(element => element.streamer == stream.user_login && element.guildid == guild);
        if (message !== -1) {
          // Update existing message
          let theMessage = messages[message];
          this.UpdateMessage(guild, theMessage.channelid, theMessage.messageid, stream);
        } else {
          // Create a new message
          let channelId = configs.find(el => el.guildid == guild).channelid;
          this.SendLiveMessage(guild, channelId, stream);
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
      this.DeleteMessage(message.guildid, message.channelid, message.messageid);
      await db.DeleteMessage(message.guildid, message.messageid);
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

    channel.messages.fetch(messageId)
      .then((existingMsg) => {
        // Delete the message from discord
        existingMsg.delete()
          .then(msg => log.log(className, `Deleted message from ${msg.guild.name}.`))
          .catch(err => log.error(className, err));
      })
      .catch(err => log.error(className, err));
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
   * Delete all of the bot's discord messages in all guilds
   */
  async Purge() {
    let messages = await db.GetMessages();
    this.DeleteMessages(messages);
    log.log(className, '[Purge]', `Purged all messages.`);
  }

  /**
   * Create a discord message
   */
  async SendLiveMessage(guildId, channelId, streamer) {
    let channel = await this.GetChannel(guildId, channelId);
    if (!channel) return;
    let msgContent = this.CreateMessage(streamer);

    channel.send({ content: null, embeds: [msgContent] })
      .then(async (message) => {
        await db.AddMessage(guildId, channelId, message.id, streamer.user_login);
        log.log(className, '[SendLiveMessage]', `Sent announcement to #${channel.name} on ${channel.guild.name} for ${streamer.user_name}.`);
      })
      .catch((e) => {
        log.warn(className, '[SendLiveMessage]', `Send error for ${streamer.user_name} in ${channel.guild.name}: ${e.message}.`);
        log.error(className, e);
      });
  }

  /**
   * Edit a discord message
   */
  async UpdateMessage(guildId, channelId, messageId, streamer) {
    let channel = await this.GetChannel(guildId, channelId);
    if (!channel) return;
    let msgContent = this.CreateMessage(streamer);
    channel.messages.fetch(messageId)
      .then((message) => {
        message.edit('', { embed: msgContent })
          .then((message) => {
            log.log(className, '[UpdateMessage]', `Updated announcement in #${channel.name} on ${channel.guild.name} for ${streamer.user_name}.`);
          })
          .catch((e) => {
            log.warn(className, '[UpdateMessage]', `Edit error for ${streamer.user_name} in ${channel.guild.name}: ${e.message}.`);
          });
      })
      .catch(async (e) => {
        // Unable to retrieve message object
        if (e.message === "Unknown Message") {
          // Specific error: the message does not exist, most likely deleted.
          // Delete the message from the DB so a new one is created next time.
          //this.SendLiveMessage(guildId, channelId, streamer);
          await db.DeleteMessage(guildId, messageId);
          return;
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

    // Add game
    if (streamer.game_name) {
      msgEmbed.addFields({ name: "Game", value: streamer.game_name, inline: false });
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
