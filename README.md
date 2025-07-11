# Twitch Monitor
🤖 **A simple Discord bot that maintains a list of live Twitch streams in a Discord channel.**

This readme was originally written for use with the Heroku free tier, however as Heroku has gotten rid of it, it's been repurposed for any generic server (I use Ubuntu).

Many bots simply post to a Discord channel when a streamer has gone live, the post gives you no indication as to whether the streamer is *still* live or what their status is, leading to the information in the channel becoming stale quickly.

This bot creates a card in the channel which updates throughout the duration of the streamer's stream, with uptime, viewcount, and a screenshot of their stream.

Once the streamer goes offline, the bot deletes the card, ensuring that the posts in your discord channel are all up-to-date and only referring to streamers who are live right now.

Multiple streamers can be added to the watch list, at your (or any server admin's) discretion.

## Features
* Maintains a real-time list of live streamers.
* Per-channel configuration: Each streamer can be configured for specific channels.
* Per-role mentions: Each streamer can have specific roles mentioned when they go live.
* Monitors Twitch streamers and posts on discord when they're live.
* Continously updates streamer card in the channel with uptime/game changes + screenshot.
* Deletes streamer card from channel when streamer goes offline.
* Discord slash commands to add/remove/list/reset watched streamers (`/watch`, `/unwatch`, `/list`, `/reset`).

## Installation
This is written for beginners, but it is expected that you at least know how to use basic unix shell commands.

**Requirements**

A server (this guide uses Ubuntu) where you have sudo.

**Instructions**
1. **Install Node**
	1. Here's a [decent guide](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04) on how to install node. I recommend using NVM (Option 3). This bot was built in node v18 so any LTS in v18 should be fine.
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
	1. Go to `https://discord.com/api/oauth2/authorize?client_id=[BOT_CLIENT_ID]&permissions=8&scope=bot`
		* Swap `[BOT_CLIENT_ID]` in the URL above for your [Discord app's client id](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
		* If you want to lock down the announcement channel so nobody but the bot can post, ensure that the bot has 	permissions at minimum to Send Messages, Manage Messages, and Embed Links.

## Commands

### `/watch`
*Adds one or more Twitch streamers to the watch list for a specific channel with optional role mentions.*

**Parameters:**
- `channel`: The Discord channel where live notifications will be posted (required)
- `role`: The role to mention when the streamer goes live (optional)
- `streamers`: Space-separated list of Twitch usernames to watch (required)

**Usage:** `/watch channel:#streams role:@gamers streamers:shroud ninja lirik`

**Features:**
- Validates that the selected channel is in the same server
- Checks bot permissions for the channel and role
- Provides detailed feedback on added/skipped/duplicate streamers
- Allows the same streamer to be watched in multiple channels with different roles

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

## Database Migration

If you're upgrading from an older version of Twitch Monitor that used the old database structure (with a single channel per guild), you'll need to migrate your database to the new structure that supports per-channel and per-role configuration.

### Automatic Migration
The bot will automatically detect if you're using the old database structure and perform the migration when you start it. The migration process:

1. **Detects** the old database structure
2. **Creates backup tables** to preserve your data
3. **Migrates** your existing streamer configurations to use the channel specified in your old config
4. **Updates** the database schema to the new structure
5. **Cleans up** old tables and backups

### Manual Migration
If you prefer to run the migration manually, you can use the migration script:

```bash
npm run migrate
```

Or run it directly:

```bash
node migrate-db.js
```

### What Gets Migrated
- **Streamer configurations**: All streamers you were watching will continue to be watched
- **Channel assignments**: Streamers will be assigned to the channel that was configured in your old setup
- **Guild settings**: All guild-specific settings are preserved
- **Role assignments**: Initially set to null (no role mentions), you can configure these using the new `/watch` command

### Post-Migration
After migration, you can:
- Use the new `/watch` command to add streamers to specific channels with optional role mentions
- Use `/unwatch` to remove streamers
- Use `/list` to see all configured streamers with their channels and roles

The old commands are no longer supported in the new version.

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


