// Multi-guild support: Done.

const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');
const logger = require('../logger');

class BoxArt {
  static category() {
    return "Bot";
  }

  static helptext() {
    return `Tells the bot whether or not to use game box art for announcements.`;
  }

	static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    let theGuild = guildConfig;
    let useBoxArt = theGuild.get("useBoxArt");
    let newBoxArt = !useBoxArt

    theGuild.put("useBoxArt", newBoxArt);

    let msgEmbed = new Discord.MessageEmbed()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addField(`BoxArt`, `Announcements ${newBoxArt ? "will" : "won't"} use game box art.`, true);
  
    message.channel.send(msgEmbed)
        .then((message) => {
            logger.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Set box art to ${newBoxArt}.`)
        })
        .catch((err) => {
            logger.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
  
	}
}
module.exports = BoxArt;