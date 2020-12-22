const Dotenv = require('dotenv').config();
const axios = require('axios');
const MiniDb = require('./minidb');
const Discord = require('discord.js');

/**
 * Discord guild event functions
 */
class DiscordGuild {
  //Expects discord guild object
  constructor(guild) {
    this._config = new MiniDb('guilds');
    this._guildDb = this._config.get("guilds") || {};

    this.guild = guild;
    console.log(`[Guild]`, `[${guild.name}]`, `New Guild object for ${guild.name}`);
    this.guildConfig = this.checkGuildConfig();
  }

  checkGuildConfig() {
    let guildConfig = this._guildDb;

    // Grab the template config to compare / update if required.
    let templateConfig = this._config.get("template") || null;

    // TODO: Handle null template (throw exception?)

    if (!guildConfig.hasOwnProperty(this.guild.id)) {
      // Guild config didn't exist. Need to create a new config from the template
      console.log(`[Guild]`, `[${this.guild.name}]`, `Guild config does't exist. Create a new config from template.`);
      guildConfig[this.guild.id] = templateConfig;
      this._config.put("guilds", guildConfig);
      return templateConfig;

    } else {
      // Config does exist
      console.log(`[Guild]`, `[${this.guild.name}]`, `Guild config exists.`);
      let thisGuildConfig = guildConfig[this.guild.id];

      // Check for any missing props and add them
      console.log(`[Guild]`, `[${this.guild.name}]`, `Checking for updated template.`);
      guildConfig[this.guild.id] = this.updateGuildConfig(thisGuildConfig, templateConfig);
      this._config.put("guilds", guildConfig);
    }

    // Config exists and is up to date
    console.log(`[Guild]`, `[${this.guild.name}]`, `Guild config exists and is up to date.`);
    return guildConfig[this.guild.id];
  }

  updateGuildConfig(guildConfig, templateConfig) {

    Object.keys(templateConfig).every(function(prop) {
      if (!guildConfig.hasOwnProperty(prop)) {
        guildConfig[prop] = templateConfig[prop];
      }
    });

    // return new object
    return guildConfig;
  }

  getWatchedRoleMembers () {
    let watchedRoles = this.guildConfig['watched-roles'] || [];
    
    // Return if there's nothing to process
    if(watchedRoles.length == 0) return watchedRoles;

    watchedRoles.forEach(roleId => {
      //console.log(this.guild.roles.fetch(roleId));
      let members = this.guild.members.cache.filter(member => member.roles.cache.find(role => role.id == roleId)).map(member => member.user.tag);

      console.log(members);
    });

  }

  // Remove a guild config
  remove () {
    let guildConfig = this._guildDb;
    if(guildConfig.hasOwnProperty(this.guild.id)) {
      delete guildConfig[this.guild.id];
      
      // Update the file
      this._config.put("guilds", guildConfig);
    }
  }

  // Get a value from the guild config
  get(property) {
    let guildConfig = this._guildDb[this.guild.id];
    return guildConfig.hasOwnProperty(property) ? guildConfig[property] : null;
  }

  // Update guild config
  put(property, value) {
    let guildConfig = this._guildDb;

    // Make sure the property we're updating exists
    if (guildConfig[this.guild.id].hasOwnProperty(property)) {
      guildConfig[this.guild.id][property] = value;

      // Update the file
      this._config.put("guilds", guildConfig);
      console.log(`[Guild]`, `[${this.guild.name}]`, `Updated ${property} to ${value}`);
    }
  }
}

module.exports = DiscordGuild;