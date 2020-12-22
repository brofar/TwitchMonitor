// Multi-guild support: Done.
// TODO: Upon set channel, delete all other messages for this guild then do immediate refresh

const MiniDb = require('../minidb');
const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');
const prefix = process.env.DISCORD_PREFIX;

/* 
* Sets the announcement channel for a guild
*/

class SetChannel {
  static category() {
    return "Discord";
  }

  static helptext() {
    return `Sets the channel to announce streams.`;
  }

	static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    this._guild = guildConfig;

    // Set up the return message
    let returnMessage = "";
    let prefix = this._guild.get("discordPrefix");
    let command = this.name.toString().trim().toLowerCase();

    let channel = message.mentions.channels.first();

    // Get the mentioned channel
    if (channel) {
      if (channel.type == 'text') {
        this._guild.put("channel", channel.id);
        returnMessage = `Channel set to ${channel.name}`;
      } else {
        returnMessage = `Please choose a text channel.`;
      }
    } else {
      returnMessage = `Please mention a channel to set. (${prefix}${command} #channelname)`;
    }

    let msgEmbed = new Discord.MessageEmbed();

    msgEmbed.setColor("#FD6A02");
    msgEmbed.setTitle(`**Twitch Monitor**`);
    msgEmbed.addField(`${command}`, returnMessage, true);

    let msgToSend = "";

    let msgOptions = {
        embed: msgEmbed
    };

    message.channel.send(msgToSend, msgOptions)
        .then((message) => {
            console.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${returnMessage}`)
        })
        .catch((err) => {
            console.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
	}
}
module.exports = SetChannel;