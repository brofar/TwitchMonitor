/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Removes ALL streamers and configurations from this server.')
    .addBooleanOption(option =>
      option.setName('confirm')
        .setDescription('Confirm that you want to remove ALL streamers from this server.')
        .setRequired(true)),
  async execute(interaction) {
    const confirmed = interaction.options.getBoolean('confirm');
    
    if (!confirmed) {
      return interaction.reply({
        content: "❌ You must confirm that you want to remove ALL streamers from this server by setting the 'confirm' option to `True`.",
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Get current streamers before resetting
      const currentStreamers = await db.ListStreamers(interaction.guild.id);
      const streamerCount = currentStreamers.length;
      
      if (streamerCount === 0) {
        return interaction.reply({
          content: "ℹ️ No streamers are currently being watched in this server.",
          flags: MessageFlags.Ephemeral
        });
      }

      // Remove all streamers from this guild
      await db.KillGuild(interaction.guild.id);

      // Create success embed
      let msgEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle(`**Twitch Monitor - Server Config Reset**`)
        .setDescription(`🗑️ Successfully removed **${streamerCount}** streamer configuration(s) from this server.`)
        .addFields(
          { name: "What was reset:", value: "• All streamer watches\n• All channel configurations\n• All role mentions", inline: false },
          { name: "Next steps:", value: "Use `/watch` to add streamers back to specific channels with optional role mentions.", inline: false }
        )
        .setFooter({ text: "This action cannot be undone." });

      let msgOptions = {
        content: null,
        embeds: [msgEmbed],
        flags: MessageFlags.Ephemeral
      };

      interaction.reply(msgOptions)
        .then(() => {
          log.log(`[RESET]`, `[${interaction.guild.name}]`, `${streamerCount} streamer configurations reset by ${interaction.user.tag}.`);
        })
        .catch((err) => {
          log.warn(`[RESET]`, `[${interaction.guild.name}]`, `Could not send confirmation message:`, err.message);
        });

    } catch (error) {
      log.error(`[RESET]`, `[${interaction.guild.name}]`, `Error resetting server configuration:`, error);

      interaction.reply({
        content: "❌ An error occurred while resetting the server configuration. Please try again or contact support.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {
        // If we can't even send the error message, just log it
        log.error(`[RESET]`, `[${interaction.guild.name}]`, `Failed to send error message to user.`);
      });
    }
  },
};
