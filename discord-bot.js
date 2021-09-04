/* General */
const Discord = require('discord.js');
const fs = require('fs');
const moment = require('moment');
const humanizeDuration = require("humanize-duration");

/* Local */
const log = require('./log');
const db = require('./db');


const className = '[Discord]';

class bot {
    async init() {
        this.client = new Discord.Client();
        this.client.commands = new Discord.Collection();

        // Find all the commands we have
        const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        log.log(className, `Discovered ${commandFiles.length} command file(s).`);

        // grab all the command files from the command directory
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            var cmdName = command.name.toString().trim().toLowerCase();
            this.client.commands.set(cmdName, command);
        }

        // alias for ease of use
        let client = this.client;

        // Discord bot connected
        client.on('ready', () => {
            log.log(className, `Bot logged in as ${client.user.tag}.`);
            this.Purge();
        });

        // Discord bot added to a server
        client.on("guildCreate", async guild => {
            await db.NewGuild(guild.id);
            log.log(className, `[${guild.name}]`, `Bot joined a new server: ${guild.name}`);
        });

        // Discord bot removed from a server
        client.on("guildDelete", async guild => {
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
        client.on('message', async message => {
            // Empty or bot message
            if (!message.content || message.author.bot) return;

            let txtPlain = message.content.toString().trim();
            let txtLower = txtPlain.toLowerCase();

            // Whitespace or blank message
            if (!txtLower.length) return;

            // If the sender isn't an admin, ignore.
            if (!message.member.hasPermission("MANAGE_CHANNELS")) return;

            // Get the guild in which the message was sent
            let _guild = await db.GetConfig(message.guild.id);
            if (typeof _guild === 'undefined') return;

            // Get ths guild's configured prefix
            let prefix = _guild.prefix;

            // Check if the message starts with the prefix
            if (txtLower.charAt(0) !== prefix) return;

            // Split the message by space characters
            const args = message.content.slice(prefix.length).trim().split(/ +/);

            // The command will be the first word
            const command = args.shift().toLowerCase();

            // If the command itself doesn't exist, ignore.
            if (!client.commands.has(command)) return;

            log.log(className, `[${message.guild.name}]`, `${command} command received from @${message.member.displayName}.`);

            // Try executing the actual command
            try {
                client.commands.get(command).execute(message, args);
            } catch (e) {
                log.warn(className, 'Command execution problem:', e);
                message.reply('There was an error trying to execute that command!');
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
            "type": "WATCHING"
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
                    .then(msg => console.log(`Deleted message from ${msg.guild.name}.`))
                    .catch(console.error);
            })
            .catch(console.error);
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


        channel.send('', { embed: msgContent })
            .then(async (message) => {
                await db.AddMessage(guildId, channelId, message.id, streamer.user_login);
                log.log(className, '[SendLiveMessage]', `Sent announcement to #${channel.name} on ${channel.guild.name} for ${streamer.user_name}.`);
            })
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
            .catch((e) => {
                // Unable to retrieve message object
                if (e.message === "Unknown Message") {
                    // Specific error: the message does not exist, most likely deleted.
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
        let msgEmbed = new Discord.MessageEmbed();
        msgEmbed.setColor("#9146ff");
        msgEmbed.setURL(`https://twitch.tv/${streamer.user_name.toLowerCase()}`);

        // Thumbnail
        let thumbUrl = streamer.profile_image_url;

        msgEmbed.setThumbnail(thumbUrl);

        msgEmbed.setTitle(`:red_circle: **${streamer.user_name} is live on Twitch!**`);
        msgEmbed.addField("Title", streamer.title, false);


        // Add game
        if (streamer.game_name) {
            msgEmbed.addField("Game", streamer.game_name, false);
        }

        // Add status
        msgEmbed.addField("Status", `Live with ${streamer.viewer_count} viewers`, true);

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

        msgEmbed.addField("Uptime", humanizeDuration(now - startedAt, {
            delimiter: ", ",
            largest: 2,
            round: true,
            units: ["y", "mo", "w", "d", "h", "m"]
        }), true);

        return msgEmbed;
    }

}

module.exports = bot;