/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ChannelType } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwatch')
    .setDescription(`Removes one or more streamers from the watch list (space separated).`)
    .addStringOption(option =>
      option.addChannelOption('channel')
        .setDescription('Which channel to remove the streamer from.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('streamers')
        .setDescription('Streamer usernames, space separated.')
        .setRequired(true)),
  async execute(interaction) {
    let removals = [];

    // Grab the streamer names from the user's command
    let users = interaction.options.getString('streamers');
    let channel = interaction.options.getChannel('channel');

    // Check channel
    if (channel && channel.type !== 'GUILD_TEXT') {
        returnMessage = `Please make sure you choose a text channel for the bot.`;

        // Set users to none to prevent any deletions
        users = "";
    }

    // Loop through all users for users to add to the list
    for (const user of users.split(' ')) {
      let userToDelete = user.toString().trim().toLowerCase();

      // Remove the '@' symbol if it exists.
      if (userToDelete.charAt(0) === '@') {
        userToDelete = userToDelete.substring(1);
      }

      // Whitespace or blank message
      if (!userToDelete.length) continue;

      await db.RemStreamer(interaction.guild.id, channel, userToDelete);

      removals.push(userToDelete);
    }

    removals.sort();

    let msgEmbed = new EmbedBuilder()
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
        log.warn(`[WATCH]`, `[${interaction.guild.name}]`, `Could not send msg to #${interaction.channel.name}`, err.message);
      });

  },
};