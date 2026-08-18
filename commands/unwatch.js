/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');
const parseNames = require('./_names');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwatch')
    .setDescription(`Removes one or more streamers from the watch list (space separated).`)

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addStringOption(option =>
      option.setName('streamers')
        .setDescription('Streamer usernames, space separated.')
        .setRequired(true)),

  async execute(interaction) {
    // Grab the streamer names from the user's command
    const { names: removals } = parseNames(interaction.options.getString('streamers'));

    for (const streamer of removals) {
      await db.RemStreamer(interaction.guild.id, streamer);
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
        log.log(`[UNWATCH]`, `[${interaction.guild.name}]`, `${removals.length} streamers removed.`);
      })
      .catch((err) => {
        log.warn(`[UNWATCH]`, `[${interaction.guild.name}]`, `Could not send msg to #${interaction.channel.name}`, err.message);
      });

  },
};