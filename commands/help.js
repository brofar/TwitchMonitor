// Multi-guild support: Done.

const Discord = require('discord.js');
const fs = require('fs');

class Help {

  static category() {
    return "General";
  }

  static helptext() {
    return `Lists all the bot commands. You can also do \`\`${this.name.toString().trim().toLowerCase()} commandname\`\` for more help with a particular command.`;
  }

	static execute(message, args, guildConfig) {
    let commandList = {}
    let msgEmbed = new Discord.MessageEmbed()
      .setColor("#FD6A02")
      .setAuthor(`Twitch Monitor`);

    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    // Check if user needs help with a specific command
    if(args[0] && commandFiles.includes(`${args[0]}.js`)) {
      const command = require(`./${args[0]}.js`);
      var cmdName = command.name.toString().trim().toLowerCase();
      let helptext = typeof command.helptext === 'function' ? command.helptext() : ""; 
      msgEmbed.addField(`${cmdName}`, helptext);
    } else { //List all commands
      // grab all the command files from the command directory
      for (const file of commandFiles) {
        const command = require(`./${file}`);
        var cmdName = command.name.toString().trim().toLowerCase();

        let cmdCategory = typeof command.category === 'function' ? command.category() : "General"; 

        console.log(`[Help]`, `Discovered ${cmdName} command in category ${cmdCategory}.`);
        
        // Clever way to check if the category exists
        // and create it if not.
        if((cmdCategory in commandList) || (commandList[cmdCategory] = [])) {
          commandList[cmdCategory].push(`\`\`${cmdName}\`\``);
        }
      }

      console.log(`[Help]`, `Discovered ${commandFiles.length} command file(s).`);

      msgEmbed.addField("Set Up", "Use the `setchannel` command to specify where updates should go.");
      msgEmbed.addField("Commands", "Commands can only be executed by users with  Administrator permissions.");
      for (const [category, cmdList] of Object.entries(commandList)) {
        msgEmbed.addField(`${category} commands`, cmdList.join(', '));
      }
    }

    // Send response to Discord
    message.channel.send(msgEmbed)
      .catch((err) => {
          console.log('[Help]', `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  }
}

module.exports = Help;