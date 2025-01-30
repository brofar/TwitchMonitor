/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwatch')
    .setDescription(`Removes one or more streamers from the watch list (space separated).`),
  async execute(interaction) {
    if (!args[0]) return;

    let userToDelete = args[0].toString().trim().toLowerCase();

    // Remove the '@' symbol if it exists.
    if (userToDelete.charAt(0) === '@') {
      userToDelete = userToDelete.substring(1);
    }

    // Whitespace or blank message
    if (!userToDelete.length) return;

    await db.RemStreamer(message.guild.id, userToDelete);

    let msgEmbed = new Discord.EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields({ name: `Removed`, value: userToDelete, inline: true });

    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `${userToDelete} deleted.`);
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  },
};