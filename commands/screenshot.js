// Multi-guild support: Done.

const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');

class ScreenShot {
  static category() {
    return "Bot";
  }

  static helptext() {
    return `Tells the bot whether or not to use stream ScreenShots for announcements.`;
  }

	static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    let theGuild = guildConfig;
    let useScreenShot = theGuild.get("useScreenShot");
    let newScreenShot = !useScreenShot

    theGuild.put("useScreenShot", newScreenShot);

    let msgEmbed = new Discord.MessageEmbed()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addField(`ScreenShot`, `Announcements ${newScreenShot ? "will" : "won't"} use stream screenshots.`, true);
  
    message.channel.send(msgEmbed)
        .then((message) => {
            console.log('[ScreenShot]', `[${message.guild.name}]`, `Set screenshot to ${newScreenShot}.`)
        })
        .catch((err) => {
            console.log('[ScreenShot]', `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
  
	}
}
module.exports = ScreenShot;