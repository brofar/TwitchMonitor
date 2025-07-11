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
    let watchedUsers = await db.ListStreamers(interaction.guild.id);

    // Group by streamer, listing all channels and roles per streamer
    const streamerMap = new Map();
    for (const entry of watchedUsers) {
      const { streamer, channelid, roleid } = entry;
      if (!streamerMap.has(streamer)) {
        streamerMap.set(streamer, []);
      }
      streamerMap.get(streamer).push({ channelid, roleid });
    }

    // Format the output for the embed
    let value;
    if (streamerMap.size > 0) {
      value = Array.from(streamerMap.entries()).map(([streamer, arr]) => {
        const lines = arr.map(({ channelid, roleid }) => {
          let channelMention = channelid ? `<#${channelid}>` : 'Unknown channel';
          let roleMention = roleid ? `(<@&${roleid}>)` : '';
          return `→ ${channelMention} ${roleMention}`;
        }).join('\n');
        return `**${streamer}**\n${lines}`;
      }).join('\n\n');
    } else {
      value = "None";
    }

    let msgEmbed = new EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields({ name: `Watch List (${streamerMap.size})`, value, inline: false });


    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[LIST]`, `[${interaction.guild.name}]`, `${watchedUsers.length} users listed.`);
      })
      .catch((err) => {
        log.warn(`[LIST]`, `[${interaction.guild.name}]`, `Could not send msg to #${interaction.channel.name}`, err.message);
      });
  },
};
