const MiniDb = require('../minidb');
const Discord = require('discord.js');
const DiscordGuild = require('../discord-guild');

/* 
* Adds a streamer to a server's watch list
* If the streamer isn't part of the global watch list, add there too.
* Check to ensure channel is configured first
*/

class AddStreamer {
  static category() {
    return "Twitch";
  }

  static helptext() {
    return `Adds a Twitch streamer to the watch list. You can specify multiple space-separated Twitch handles for quick addition. Usage: \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1\`\` or \`\`${this.name.toString().trim().toLowerCase()} twitchhandle1 twitchhandle2\`\`.`;
  }

	static execute(message, args, guildConfig) {
    // Get the guild in which the message was sent
    this._guild = guildConfig;
    this._guildData = this._guild.get('watch-list') || { };
    let guildWatchedUsers = this._guildData['usernames'] || [ ];

    let result = {"added" : [], "skipped": []};

    // Loop through all users for users to add to the list
    for (const user of args) {
      let userToAdd = user.toString().trim().toLowerCase();

      // Remove the '@' symbol if it exists.
      if(userToAdd.charAt(0) === '@') {
        userToAdd = userToAdd.substring(1);
      }

      // Whitespace or blank message
      if (!userToAdd.length) continue;

      // Skip if name is too long to be a Twitch account.
      if(userToAdd.length > 30) {
        result.skipped.push(userToAdd);
        continue;
      }

      // If they're not already on the guild list, add them
      if(guildWatchedUsers.indexOf(userToAdd) === -1) {

        guildWatchedUsers.push(userToAdd);
        console.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Added ${userToAdd} to guild watch list.`);

        result.added.push(userToAdd);
      } else {
        result.skipped.push(userToAdd);
      }
    }

    // Update guild list
    this._guildData['usernames'] = guildWatchedUsers;
    this._guild.put("watch-list", this._guildData);

    result.added.sort();
    result.skipped.sort();

    let msgEmbed = new Discord.MessageEmbed();

    msgEmbed.setColor("#FD6A02");
    msgEmbed.setTitle(`**Twitch Monitor**`);
    msgEmbed.addField(`Added (${result.added.length})`, result.added.length > 0 ?result.added.join('\n') : "None", true);
    msgEmbed.addField(`Skipped (${result.skipped.length})`, result.skipped.length > 0 ?result.skipped.join('\n') : "None", true);

    let msgToSend = "";

    let msgOptions = {
        embed: msgEmbed
    };

    message.channel.send(msgToSend, msgOptions)
        .then((message) => {
            console.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${result.added.length} added. ${result.skipped.length} duplicates.`)
        })
        .catch((err) => {
            console.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
        });
	}
}
module.exports = AddStreamer;