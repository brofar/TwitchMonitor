/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

class List {

  static category() {
    return "Twitch";
  }

  static helptext() {
    return `Lists all streamers the bot is currently watching.`;
  }

  static async execute(message, args) {
    let watchedUsers = await db.ListStreamers(message.guild.id)

    watchedUsers.sort();

    let msgEmbed = new Discord.MessageEmbed()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields({ name: `Watch List (${watchedUsers.length})`, value: watchedUsers.length > 0 ? watchedUsers.join('\n') : "None", inline: true });


    let msgOptions = {
      content: null,
      embeds: [msgEmbed]
    };

    message.channel.send(msgOptions)
      .then((message) => {
        log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${watchedUsers.length} users listed.`);
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}

module.exports = List;