# Twitch Monitor
🤖 **A simple bot that maintains a list of live Twitch streams in a Discord channel.**

Many bots simply post to a Discord channel when a streamer has gone live, the post gives you no indication as to whether the streamer is *still* live or what their status is, leading to the information in the channel becoming stale quickly.

This bot creates a card in the channel which updates every minute throughout the duration of the stream, with uptime, viewcount, and a screenshot of their stream.

Once the streamer goes offline, the bot deletes the card, ensuring that the posts in the discord channel are all up-to-date and only referring to streamers who are actually live.

Multiple streamers can be added to the watch list, and each one can be assigned to different (or the same) channel at your discretion.

## Features
* Monitors Twitch streamers and posts on discord when they're live.
* Per-channel configuration: Each streamer can be configured for specific channels. Multiple streamers can be configured for the same channel as well.
* Per-role mentions: Each streamer can optionally have specific roles mentioned when they go live.
* Continously updates streamer card in the channel with uptime/game changes + screenshot.
* Deletes its own message from channel when streamer goes offline.
* Uses Discord slash commands to add/remove/list/reset watched streamers (`/watch`, `/unwatch`, `/list`, `/reset`).

## Installation
These instructions are written for unix (I use Ubuntu to host mine), but I'm sure you could run it on other operating systems as well, it's just Node after all. Anyway, these are written for beginner-ish users but it is expected that you at least know how to use unix shell commands.

**Requirements**

A server (this guide uses Ubuntu) where you have sudo.

**Instructions**
1. **Install Node**
	1. Here's a [decent guide](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04) on how to install node. I recommend using NVM (Option 3).
1. **Install a Node Process Manager**
	1. I use PM2 `npm install pm2@latest -g`
1. **Install PostgreSQL**
	1. `sudo apt update`
	1. Install PostgreSQL `sudo apt install postgresql postgresql-contrib`
	1. Run PostgreSQL `sudo systemctl start postgresql.service`
	1. Create a user `sudo -u postgres createuser --interactive`
		1. Enter a name of your choice (the easiest is to use the same name as your unix username)
		1. Superuser: Y
	1. Set a psql password for the user
		1. `psql`
		1. Enter and remember a password for the user. `\password`
		1. Quit psql `\q`
	1. Create a DB `sudo -u postgres createdb twitchmon`
1. **Get the Bot**
	1. Clone the repo into a folder on the server `git clone https://github.com/brofar/TwitchMonitor.git`
	1. Rename `.env.sample` to `.env`.
	1. Set the `DATABASE_URL` to `postgres://[username]:[password]@localhost:5432/twitchmon`.
		1. Swap `[username]` with the psql username you created above.
		1. Swap `[password]` with the psql password you set above.
1. **Get a Discord Token**
	1. Generate a Discord bot token by [following this guide](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
	1. Copy the token into `DISCORD_BOT_TOKEN` in your `.env` file.
  1. Copy your Discord application's Client ID to the `DISCORD_CLIENT_ID` in your `.env` file
1. **Get a Twitch Token**
	1. Create a Twitch app on the [Twitch Developer Console](https://dev.twitch.tv/console/apps) (When it asks, set the OAuth Redirect URL to `http://localhost`)
	1. Copy the Twitch `Client ID` into the `TWITCH_CLIENT_ID` in your `.env` file.
	1. Copy the Twitch `Client Secret` into the `TWITCH_CLIENT_SECRET` in your `.env` file.
1. **Deploy the Slash Commands**
  1. `cd` into the bot's directory
  1. `npm run deploy`
1. **Start the Bot**
	1. `pm2 start app.js --name twitch-monitor`
1. **Invite the Bot to your Discord Server**
	1. Go to `https://discord.com/api/oauth2/authorize?client_id=[BOT_CLIENT_ID]&permissions=223232&scope=bot`
		* Swap `[BOT_CLIENT_ID]` in the URL above for your [Discord app's client id](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
		* If you want to lock down the announcement channel so nobody but the bot can post, ensure that the bot has 	permissions at minimum to Send Messages, Manage Messages, and Embed Links in that channel.

## Commands

### `/watch`
*Adds one or more Twitch streamers to the watch list for a specific channel with optional role mentions.*

**Parameters:**
- `channel`: The Discord channel where live notifications will be posted (required)
- `role`: The role to mention when the streamer goes live (optional)
- `streamers`: Space-separated list of Twitch usernames to watch (required)

**Usage:** `/watch channel:#streams role:@gamers streamers:shroud ninja lirik`

### `/unwatch`
*Removes one or more Twitch streamers from the watch list.*

**Parameters:**
- `streamers`: Space-separated list of Twitch usernames to stop watching (required)

**Usage:** `/unwatch streamers:shroud ninja`

**Note:** This removes the streamer from ALL channels in the current server.

### `/list`
*Lists all streamers the bot is currently watching in the server, organized by streamer with their configured channels and roles.*

**Usage:** `/list`

**Output:** Shows streamers grouped with their respective channels and role mentions.

### `/reset`
*Removes ALL streamers and configurations from the current server. This is useful for completely resetting the bot's configuration.*

**Parameters:**
- `confirm`: Must be set to `True` to confirm the action (required)

**Usage:** `/reset confirm:True`

**⚠️ Warning:** This action cannot be undone! It will remove:
- All streamer watches from all channels
- All channel configurations  
- All role mention settings

Use this command carefully - it's intended for completely resetting the bot's configuration in your server.

## Command Deployment

After setting up the bot, you need to deploy the slash commands to Discord:

```bash
npm run deploy
```

Or run it directly:

```bash
node deploy-commands.js
```

This only needs to be done once when you first set up the bot, or when you update command definitions. The bot will automatically load all commands from the `commands/` directory.


