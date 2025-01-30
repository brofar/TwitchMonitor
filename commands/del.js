/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

class Del {

  static category() {
    return "Twitch";
  }

  static helptext() {
    return `Removes a Twitch streamer from the watch list. You can specify multiple space-separated Twitch handles for quick removal. Usage: \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1\`\` or \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1 twitchhandle2\`\`.`;
  }

  static async execute(message, args) {
    if (!args[0]) return;

    let userToDelete = args[0].toString().trim().toLowerCase();

    // Remove the '@' symbol if it exists.
    if (userToDelete.charAt(0) === '@') {
      userToDelete = userToDelete.substring(1);
    }

    // Whitespace or blank message
    if (!userToDelete.length) return;

    await db.RemStreamer(message.guild.id, userToDelete);

    let msgEmbed = new Discord.MessageEmbed();

    msgEmbed.setColor("#FD6A02");
    msgEmbed.setTitle(`**Twitch Monitor**`);
    msgEmbed.addField(`Removed`, userToDelete, true);


    let msgOptions = {
      
      embeds: [msgEmbed]
    };

    message.channel.send(msgOptions)
      .then((message) => {
        log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${userToDelete} deleted.`)
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}

module.exports = Del;