/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

/* 
* Adds a streamer to a server's watch list
* If the streamer isn't part of the global watch list, add there too.
* Check to ensure channel is configured first
*/

class Add {
  static category() {
    return "Twitch";
  }

  static helptext() {
    return `Adds a Twitch streamer to the watch list. You can specify multiple space-separated Twitch handles for quick addition. Usage: \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1\`\` or \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1 twitchhandle2\`\`.`;
  }

  static async execute(message, args) {
    if (!args[0]) return;

    let result = { "added": [], "skipped": [] };

    let adds = [];

    // Loop through all users for users to add to the list
    for (const user of args) {
      let userToAdd = user.toString().trim().toLowerCase();

      // Remove the '@' symbol if it exists.
      if (userToAdd.charAt(0) === '@') {
        userToAdd = userToAdd.substring(1);
      }

      // Whitespace or blank message
      if (!userToAdd.length) continue;

      // Skip if name is too long to be a Twitch account.
      if (userToAdd.length > 30) {
        result.skipped.push(userToAdd);
        continue;
      }

      result.added.push(userToAdd);
      adds.push({
        guildid: message.guild.id,
        streamer: userToAdd
      });
    }

    await db.AddStreamers(adds);

    result.added.sort();
    result.skipped.sort();

    let msgEmbed = new Discord.MessageEmbed();

    msgEmbed.setColor("#FD6A02");
    msgEmbed.setTitle(`**Twitch Monitor**`);
    msgEmbed.addField(`Added (${result.added.length})`, result.added.length > 0 ? result.added.join('\n') : "None", true);
    msgEmbed.addField(`Skipped (${result.skipped.length})`, result.skipped.length > 0 ? result.skipped.join('\n') : "None", true);

    let msgOptions = {
      content: "",
      embeds: [msgEmbed]
    };

    message.channel.send(msgOptions)
      .then((message) => {
        log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${result.added.length} added. ${result.skipped.length} duplicates.`)
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}
module.exports = Add;