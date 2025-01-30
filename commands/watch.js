/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription(`Adds one or more Twitch streamers to the watch list (if multiple, separate the usernames with spaces).`),
  async execute(interaction) {
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

    let msgEmbed = new Discord.EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields(
        { name: `Added (${result.added.length})`, value: result.added.length > 0 ? result.added.join('\n') : "None", inline: true },
        { name: `Skipped (${result.skipped.length})`, value: result.skipped.length > 0 ? result.skipped.join('\n') : "None", inline: true }
      );

    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `${result.added.length} added. ${result.skipped.length} duplicates.`);
      })
      .catch((err) => {
        log.warn(`[${this.name.toString().trim()}]`, `[${interaction.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });
  },
};