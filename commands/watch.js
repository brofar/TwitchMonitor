/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ChannelType } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription(`Adds one or more streamers to the watch list (space separated).`)

    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel in which to post the live notifications.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('streamers')
        .setDescription('Streamer usernames, space separated.')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('[OPTIONAL] Which role to ping with the live notifications.')
        .setRequired(false)),

  async execute(interaction) {
    let result = { "added": [], "skipped": [], "duplicates": [] };

    let adds = [];

    // Grab the streamer names from the user's command
    let users = interaction.options.getString('streamers');
    let channel = interaction.options.getChannel('channel');
    let role = interaction.options.getRole('role');

    // Validation: Ensure the selected channel is in the same guild
    if (channel.guild.id !== interaction.guild.id) {
      return interaction.reply({
        content: "❌ The selected channel must be in the same server as this command.",
        flags: MessageFlags.Ephemeral
      });
    }

    // Validation: Ensure the bot has permission to mention the role
    if (role) {
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember) {
        return interaction.reply({
          content: "❌ Unable to verify bot permissions.",
          flags: MessageFlags.Ephemeral
        });
      }

      // Check if the role is mentionable or if the bot has permission to mention any role
      if (!role.mentionable && !botMember.permissions.has('MentionEveryone')) {
        return interaction.reply({
          content: `❌ I don't have permission to mention the role **${role.name}**. Either make the role mentionable or give me the "Mention Everyone" permission.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // Validation: Ensure the bot has permission to send messages in the channel
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (!channel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
      return interaction.reply({
        content: `❌ I don't have permission to send messages or embed links in ${channel}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Loop through all users for users to add to the list
    for (const user of users.split(' ')) {
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

      adds.push({
        guildid: interaction.guild.id,
        channelid: channel.id,
        roleid: role ? role.id : null,
        streamer: userToAdd
      });
    }

    // Add streamers to database and get results
    const dbResults = await db.AddStreamers(adds);
    result.added = dbResults.added;
    result.duplicates = dbResults.skipped;

    result.added.sort();
    result.skipped.sort();
    result.duplicates.sort();

    let msgEmbed = new EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields(
        { name: `Added (${result.added.length})`, value: result.added.length > 0 ? result.added.join('\n') : "None", inline: true },
        { name: `Skipped - Invalid (${result.skipped.length})`, value: result.skipped.length > 0 ? result.skipped.join('\n') : "None", inline: true },
        { name: `Skipped - Duplicates (${result.duplicates.length})`, value: result.duplicates.length > 0 ? result.duplicates.join('\n') : "None", inline: true }
      );

    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[WATCH]`, `[${interaction.guild.name}]`, `${result.added.length} added. ${result.skipped.length} invalid. ${result.duplicates.length} duplicates.`);
      })
      .catch((err) => {
        log.warn(`[WATCH]`, `[${interaction.guild.name}]`, `Could not send msg to #${interaction.channel.name}`, err.message);
      });
  },
};
