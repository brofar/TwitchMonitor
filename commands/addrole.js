const MiniDb = require('../minidb');
const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');

class AddRole {
  static category() {
    return "Discord";
  }

  static helptext() {
    return `Adds a Discord role to the watch list. Members in this role (if they have a Twitch account associated with their Discord account) will be added to the Twitch watch list.`;
  }

	static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    this._guild = guildConfig;
    let watchedRoles = this._guild.get('watched-roles') || [ ];
    let msgToSend = "";

    let role = message.mentions.roles.first();

    if (!role) return;

    // If they're not already on the guild list, add them
    if(watchedRoles.indexOf(role.id) === -1) {
      watchedRoles.push(role.id);
      msgToSend = `Added ${role.name} to role watch list.`;
      console.log('[AddRole]', `[${message.guild.name}]`, msgToSend);
    } else {
      msgToSend = `${role.name} is already on the watch list.`;
    }

    guildConfig.getWatchedRoleMembers ();

    // Update guild list
    this._guild.put("watched-roles", watchedRoles);

    message.channel.send(msgToSend)
        .then((message) => {
            console.log('[AddRole]', `[${message.guild.name}]`, `${role.name} added to role watch list.`)
        })
        .catch((err) => {
            console.log('[AddRole]', `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
	}
}
module.exports = AddRole;