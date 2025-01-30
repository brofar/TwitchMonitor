# Twitch Monitor
🤖 **A simple Discord bot that maintains a list of live Twitch streams in a Discord channel.**

This readme was originally written for use with the Heroku free tier, however as Heroku has gotten rid of it, it's been repurposed for any generic server (I use Ubuntu).

Many bots simply post to a Discord channel when a streamer has gone live, the post gives you no indication as to whether the streamer is *still* live or what their status is, leading to the information in the channel becoming stale quickly.

This bot creates a card in the channel which updates throughout the duration of the streamer's stream, with uptime, viewcount, and a screenshot of their stream.

Once the streamer goes offline, the bot deletes the card, ensuring that the posts in your discord channel are all up-to-date and only referring to streamers who are live right now.

Multiple streamers can be added to the watch list, at your (or any server admin's) discretion.

## Features
* Maintains a real-time list of live streamers.
* No annoying @everyone mentions.
* Monitors Twitch streamers and posts on discord when they're live.
* Continously updates streamer card in the channel with uptime/game changes + screenshot.
* Deletes streamer card from channel when streamer goes offline.
* Discord commands to add/remove/list watched streamers (\`add / \`del / \`list).

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
1. **Start the Bot**
	1. `cd` into the bot's directory
	1. `pm2 start app.js --name twitch-monitor`
1. **Invite the Bot to your Discord Server**
	1. Go to `https://discord.com/api/oauth2/authorize?client_id=[BOT_CLIENT_ID]&permissions=8&scope=bot`
		* Swap `[BOT_CLIENT_ID]` in the URL above for your [Discord app's client id](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
		* If you want to lock down the announcement channel so nobody but the bot can post, ensure that the bot has 	permissions at minimum to Send Messages, Manage Messages, and Embed Links.
	1. Start by issuing the  `` `channel`` command (`` `channel #live-now``) to tell the bot where to post its messages.
	1. Add streamers by issuing `` `add streamer1 streamer2 etc etc``
	1. Remove streamers by issuing `` `del streamer1 streamer2 etc etc``
	1. List followed streamers by issuing `` `list``
	1. Change the bot's command prefix using `` `prefix !`` (this would change the prefix from `` ` `` to `!`)

## Commands
Assuming the default command prefix.

### `channel
*Sets the channel where the bot will announce streams.*

Usage: `` `channel #live-now``

### `prefix
*Changes the bot's command prefix.*

Usage: `` `prefix !``

### `add
*Adds a Twitch streamer to the watch list. You can specify multiple space-separated Twitch handles for quick addition.*

Usage: `` `add user1 user2 user3``

### `del
*Removes a Twitch streamer from the watch list. You can specify multiple space-separated Twitch handles for quick removal.*

Usage: `` `del user1 user2 user3``

### `list
*Lists all streamers the bot is currently watching.*

Usage: `` `list``


