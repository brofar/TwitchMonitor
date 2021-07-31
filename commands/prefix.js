/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

class Prefix {
    static category() {
        return "Bot";
    }

    static helptext() {
        return `Changes the bot's command prefix.`;
    }

    static async execute(message, args) {
        if (!args[0]) return;
        // Get the guild in which the message was sent
        let _guild = await db.GetConfig(message.guild.id);
        if (typeof _guild === 'undefined') return;

        let newPrefix = args[0].toString().trim().charAt(0);
        await db.UpdateGuild(_guild.guildid, 'prefix', newPrefix);

        let msgEmbed = new Discord.MessageEmbed()
            .setColor("#FD6A02")
            .setTitle(`**Twitch Monitor**`)
            .addField(`Prefix`, `Bot prefix set to ${newPrefix}`, true);

        message.channel.send(msgEmbed)
            .then((message) => {
                log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Set bot prefix to ${newPrefix}.`)
            })
            .catch((err) => {
                log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
            });
    }
}
module.exports = Prefix;