/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwatch')
    .setDescription(`Removes one or more streamers from the watch list (space separated).`)
    .addStringOption(option =>
      option.setName('streamers')
        .setDescription('Streamer usernames, space separated.')
        .setRequired(true)),
  async execute(interaction) {
    let removals = [];

    // Grab the streamer names from the user's command
    let users = interaction.options.getString('streamers');

    // Loop through all users for users to add to the list
    for (const user of users.split(' ')) {
      let userToDelete = user.toString().trim().toLowerCase();

      // Remove the '@' symbol if it exists.
      if (userToDelete.charAt(0) === '@') {
        userToDelete = userToDelete.substring(1);
      }

      // Whitespace or blank message
      if (!userToDelete.length) continue;

      await db.RemStreamer(interaction.guild.id, userToDelete);

      removals.push(userToDelete);
    }

    removals.sort();

    let msgEmbed = new Discord.EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields(
        { name: `Removed (${removals.length})`, value: removals.length > 0 ? removals.join('\n') : "None", inline: false },
      );

    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[WATCH]`, `[${interaction.guild.name}]`, `${result.added.length} deleted. ${result.skipped.length} duplicates.`);
      })
      .catch((err) => {
        log.warn(`[WATCH]`, `[${interaction.guild.name}]`, `Could not send msg to #${message.channel.name}`, err.message);
      });

  },
};