// Multi-guild support: Done.
// TODO: Upon set channel, delete all other messages for this guild then do immediate refresh

const MiniDb = require('../minidb');
const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');
const logger = require('../logger');

/* 
* Sets the announcement channel for a guild
*/

class SetRoles {
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

    if(!message.guild.me.hasPermission("MANAGE_ROLES")) {
      // "I don't have Manage Roles permissions on your server!"
      logger.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Bot doesn't have MANAGE_ROLES permission.`);
    }

    // Get the mentioned role(s)
    let roles = message.mentions.roles;

    // If 1 role, then that's the role to monitor
    // If 2 roles, second is the target role for active streamers
    if (roles.length > 0) {
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
            logger.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${returnMessage}`)
        })
        .catch((err) => {
            logger.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
	}
}
module.exports = SetRoles;