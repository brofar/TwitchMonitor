/* General */
const Discord = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

class DelBl {

    static category() {
        return "Twitch";
    }

    static helptext() {
        return `Removes a Twitch streamer from the blacklist.`;
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

        await db.RemStreamerFromBlacklist(message.guild.id, userToDelete);

        let msgEmbed = new Discord.MessageEmbed();

        msgEmbed.setColor("#FD6A02");
        msgEmbed.setTitle(`**Twitch Monitor**`);
        msgEmbed.addField(`Removed`, userToDelete, true);

        let msgToSend = "";

        let msgOptions = {
            embed: msgEmbed
        };

        message.channel.send(msgToSend, msgOptions)
            .then((message) => {
                log.log(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `${userToDelete} deleted.`)
            })
            .catch((err) => {
                log.warn(`[${this.name.toString().trim()}]`, `[${message.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
            });
    }
}

module.exports = DelBl;