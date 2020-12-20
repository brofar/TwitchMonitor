// Multi-guild support: Done.

const MiniDb = require('../minidb');
const Discord = require('discord.js');
const prefix = process.env.DISCORD_PREFIX;

class ListStreamers {
  
  static category() {
    return "Twitch";
  }

  static helptext() {
    return `Lists all streamers the bot is currently watching.`;
  }

  static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    this._guild = guildConfig;
    this._guildData = this._guild.get('watch-list') || { };
    let watchedUsers = this._guildData['usernames'] || [ ];

    watchedUsers.sort();

    let msgEmbed = new Discord.MessageEmbed();

    msgEmbed.setColor("#FD6A02");
    msgEmbed.setTitle(`**Twitch Monitor**`);
    msgEmbed.addField(`Watch List (${watchedUsers.length})`, watchedUsers.length > 0 ? watchedUsers.join('\n') : "None", true);

    let msgToSend = "";

    let msgOptions = {
      embed: msgEmbed
    };

    message.channel.send(msgToSend, msgOptions)
      .then((message) => {
        console.log('[Discord-List]', `[${message.guild.name}]`, `${watchedUsers.length} users listed.`);
      })
      .catch((err) => {
        console.log('[Discord-List]', `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}

module.exports = ListStreamers;