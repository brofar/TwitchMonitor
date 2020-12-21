// Multi-guild support: Done.

const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');

class SetPrefix {
  static category() {
    return "Bot";
  }

  static helptext() {
    return `Changes the bot's command prefix.`;
  }

	static execute(message, args, guildConfig) {
    if(args[0]) {
      // Get the guild in which the message was sent
      let theGuild = guildConfig;
      let prefix = theGuild.get("discordPrefix");

      let newPrefix = args[0].toString().trim().charAt(0);
      theGuild.put("discordPrefix", newPrefix);

      let msgEmbed = new Discord.MessageEmbed()
        .setColor("#FD6A02")
        .setTitle(`**Twitch Monitor**`)
        .addField(`Prefix`, `Bot prefix set to ${newPrefix}`, true);
    
      message.channel.send(msgEmbed)
          .then((message) => {
              console.log('[SetPrefix]', `[${message.guild.name}]`, `Set bot prefix to ${newPrefix}.`)
          })
          .catch((err) => {
              console.log('[SetPrefix]', `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
          });
    }
	}
}
module.exports = SetPrefix;