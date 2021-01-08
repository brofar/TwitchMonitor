/**
 * Helper class for syncing discord target channels.
 */

const MiniDb = require('./minidb');

class DiscordChannelSync {

  static getChannelList(client, verbose) {

    let guildDb = new MiniDb('guilds');
    let guilds = guildDb.get('guilds') || {};

    let allChannels = []

    // Iterate through each guild
    for (let guildId in guilds) {

      let guild = guilds[guildId];

      let targetChannel = this.getChannel(client, guildId, guild.channel, verbose);

      if(targetChannel) {
        // Add watched userstargetChannel
        targetChannel['watch-list'] = guild['watch-list'].usernames;

        // Add into master array
        allChannels.push(targetChannel);

        console.log('[Discord]', `Added ${targetChannel.guild.name} #${targetChannel.name} to channel cache.`);
      }
    }

    if (verbose) {
      console.log('[Discord]', `Discovered ${allChannels.length} announcement channel(s).`);
    }

    return allChannels;
  }

  /**
   * @param {Client} client Discord.js client.
   * @param {int} guildId numerical id of the Discord guild the channel is in.
   * @param {int} channelId numerical id of the Discord channel we are looking for.
   * @param {boolean} verbose If true, log guild membership info to stdout (debug / info purposes).
   * @return {Channel} Discord.js channel object
   */
  static getChannel(client, guildId, channelId, verbose) {
    let targetChannel;

    let guild = client.guilds.cache.get(guildId);
    if(!guild) return;
    targetChannel = guild.channels.cache.get(channelId);

    if (!targetChannel) {
        if (verbose) {
          console.warn('[Discord]', 'Configuration problem ⚠ ', `Guild ${guild.name} does not have a <#${channelId}> channel!`);
        }
      } else {
      let permissions = targetChannel.permissionsFor(guild.me);

      if (verbose) {
        console.log('[Discord]', ' --> ', `Member of server ${guild.name}, target channel is #${targetChannel.name}`);
      }

      if (!permissions.has("SEND_MESSAGES")) {
        if (verbose) {
          console.warn('[Discord]', 'Permission problem ⚠', `I do not have SEND_MESSAGES permission on channel #${targetChannel.name} on ${guild.name}: announcement sends will fail.`);
        }
      }
    }

    return targetChannel;
  }
}

module.exports = DiscordChannelSync;