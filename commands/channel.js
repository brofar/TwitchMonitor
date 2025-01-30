// TODO: Upon set channel, delete all other messages for this guild then do immediate refresh
/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

/* 
* Sets the announcement channel for a guild
*/

class Channel {
  static category() {
    return "Discord";
  }

  static helptext() {
    return `Sets the channel to announce streams.`;
  }

  static async execute(message, args) {
    if (!args[0]) return;
    // Get the guild in which the message was sent
    let _guild = await db.GetConfig(message.guild.id);
    if (typeof _guild === 'undefined') return;

    // Set up the return message
    let returnMessage = "";
    let prefix = _guild.prefix;
    let command = this.name.toString().trim().toLowerCase();

    // Grab the mentioned channel from the user's command
    let channel = message.mentions.channels.first();

    // Update the channel config
    if (channel) {
      if (channel.type === 'GUILD_TEXT') {
        await db.UpdateGuild(_guild.guildid, 'channelid', channel.id);
        returnMessage = `Channel set to ${channel.name}.`;
      } else {
        returnMessage = `Please make sure you choose a text channel for the bot.`;
      }
    } else {
      returnMessage = `Please mention a channel to set. (${prefix}${command} #channelname)`;
    }

    let msgEmbed = new Discord.EmbedBuilder()
    .setColor("#FD6A02")
    .setTitle(`**Twitch Monitor**`)
    .addFields({name: `${command}`, value: returnMessage, inline: true});

    let msgOptions = {
      content: null,
      embeds: [msgEmbed]
    };

    message.channel.send(msgOptions)
      .then((message) => {
        log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${returnMessage}`)
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}
module.exports = Channel;