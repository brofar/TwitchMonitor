/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Lists all the streamers Twitch Monitor is tracking.'),
  async execute(interaction) {

    let watchedUsers = await db.ListStreamers(interaction.guild.id)

    watchedUsers.sort();

    let msgEmbed = new EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields({ name: `Watch List (${watchedUsers.length})`, value: watchedUsers.length > 0 ? watchedUsers.join('\n') : "None", inline: true });


    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `${watchedUsers.length} users listed.`);
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  },
};