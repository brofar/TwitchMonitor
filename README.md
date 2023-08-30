# Twitch Monitor - FF8 Speedrunning
🤖 **A simple Discord bot that maintains a list of live FF8 Speedrun Twitch streams in a Discord channel.**

This bot creates a card in the channel which updates throughout the duration of the streamer's stream, with uptime, viewcount, and a screenshot of their stream.

Once the streamer goes offline, the bot deletes the card, ensuring that the posts in your discord channel are all up-to-date and only referring to streamers who are live right now.

The bot checks stream tags for `speedrun` or `speedrunning` and for the stream game being either `Final Fantasy VIII` or the remaster. If both criteria are met, it will post the stream.

## Features
* Maintains a real-time list of live streamers.
* Monitors Twitch streamers and posts on discord when they're live.
* Continously updates streamer card in the channel with uptime/game changes + screenshot.
* Deletes streamer card from channel when streamer goes offline.
* Blacklist capabilities to never announce specific streamers as required.

## Installation
This is written for beginners, but it is expected that you at least know how to use basic unix shell commands.

**Requirements**

A server (this guide uses Ubuntu) where you have sudo.

**Instructions**
1. **Install Node**
	1. Here's a [decent guide](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04) on how to install node. I recommend using NVM (Option 3). This bot was built in node v18 so any LTS in v18 should be fine.
1. **Install a Node Process Manager**
	1. I use PM2 `npm install pm2@latest -g`
1. **Get the Bot**
	1. Clone the repo into a folder on the server `git clone https://github.com/brofar/TwitchMonitor.git`
	1. Rename `.env.sample` to `.env`.
	1. Install dependencies by running `npm install` in the code's directory.
1. **Get a Discord Token**
	1. Generate a Discord bot token by [following this guide](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
	1. Copy the token into `DISCORD_BOT_TOKEN` in your `.env` file.
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
	1. Start by issuing the  `` `channel`` command (`` `channel #live-now``) to tell the bot where to post its messages.
		* If you are going to lock down the announcement channel so nobody but the bot can post, please ensure that the bot has permissions to `Send Messages`, `Manage Messages`, and `Embed Links` in that channel.

## Commands
| Command | Description                                                                                    | Example                   |
|---------|------------------------------------------------------------------------------------------------|---------------------------|
| channel | Set the channel for the bot to post in.                                                        | `` `channel #live-now``   |
| prefix  | Change the bot's command prefix.                                                               | `` `prefix !``            |
| addbl   | Add a user to the blacklist.<br />They won't be displayed even if they match the game/tag criteria. | `` `addbl @streamername`` |
| delbl   | Remove a user from the blacklist.                                                              | `` `delbl @streamer``     |
| listbl  | List users on the blacklist.                                                                   | `` `listbl``              |

# Modifying the Criteria
If you want to use this bot to monitor different games or tags (e.g. FFX speedruns), you should change either/both of these lines in `twitch-monitor.js`. Note that the bot will announce a stream only if it matches BOTH the game AND the tag.

Twitch Game ID (you can find the ID of your game via the Twitch API, or some of the lists posted online)

```const gameId = [11282, 514788, 1736914392];```

Tags to check for (case insensitive)

```const targetTags = ['speedrun', 'speedrunning'];```