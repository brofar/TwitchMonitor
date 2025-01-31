// TODO: Upon set channel, delete all other messages for this guild then do immediate refresh
/* General */
const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ChannelType } = require('discord.js');

/* Local */
const log = require('../log');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription(`Sets the channel to announce streams.`)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to post in.')
        .setRequired(true)
        // Ensure the user can only select a TextChannel for output
        .addChannelTypes(ChannelType.GuildText)),
  async execute(interaction) {
    // Get the guild in which the message was sent
    let _guild = await db.GetConfig(interaction.guild.id);
    if (typeof _guild === 'undefined') return;

    // Set up the return message
    let returnMessage = "";

    // Grab the mentioned channel from the user's command
    let channel = interaction.options.getChannel('channel');

    // Update the channel config
    if (channel) {
      if (channel.type === 'GUILD_TEXT') {
        await db.UpdateGuild(_guild.guildid, 'channelid', channel.id);
        returnMessage = `Channel set to ${channel.name}.`;
      } else {
        returnMessage = `Please make sure you choose a text channel for the bot.`;
      }
    } else {
      returnMessage = `Please choose a channel.`;
    }

    let msgEmbed = new Discord.EmbedBuilder()
      .setColor("#FD6A02")
      .setTitle(`**Twitch Monitor**`)
      .addFields({ name: `Set Channel`, value: returnMessage, inline: true });

    let msgOptions = {
      content: null,
      embeds: [msgEmbed],
      flags: MessageFlags.Ephemeral
    };

    interaction.reply(msgOptions)
      .then(() => {
        log.log(`[SETCHANNEL]`, `[${interaction.guild.name}]`, `${returnMessage}`);
      })
      .catch((err) => {
        log.warn(`[SETCHANNEL]`, `[${interaction.guild.name}]`, `Could not send msg to #${interaction.channel.name}`, err.message);
      });
  },
};
