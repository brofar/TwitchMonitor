# Twitch Monitor (Heroku Version)
🤖 **A simple Discord bot that maintains a list of live Twitch streams in a Discord channel.**

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
* Discord commands to add/remove/list watched streamers (\`add / \`rm / \`list).
* Can be run entirely on the Heroku free tier.

## Installation
(Windows) This is written for beginners, but it is expected that you at least know how to use the Windows command prompt.

**Set up the Heroku App**
1. Head over to http://heroku.com/ and create an account.
1. In the Heroku Dashboard, click `Create new app`
1. Give your app a name, and decide where you want to host it, then click `Create app`.
1. Go to your app's [Resources](https://dashboard.heroku.com/apps/twitchmon/resources) page.
1. Search for `Heroku Postgres` and select (the Free plan is sufficient), submit the order form.

**Download the Bot**
1. Clone this repo somewhere on your system using `git clone` or the `Download ZIP` feature in Github.
1. Rename `.env.sample` to `.env`.
1. **DELETE** the `.gitignore` file.

**Get Discord Token**
1. Generate a Discord bot token by [following this guide](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
1. Copy the token into `DISCORD_BOT_TOKEN` in your `.env` file.

**Get Twitch Token**
1. Generate Twitch `Client ID` tokens at the [Twitch Developer Console](https://dev.twitch.tv/console/apps) (When it asks, set the OAuth Redirect URL to `http://localhost`)
1. Copy the Twitch `Client ID` into the `TWITCH_CLIENT_ID` in your `.env` file.
1. Navigate to `https://id.twitch.tv/oauth2/authorize?client_id=TWITCH_CLIENT_ID&response_type=token&redirect_uri=http://localhost`, replacing `TWITCH_CLIENT_ID` with your actual Client ID.
1. Log in with Twitch.
1. Grab the `access_token` from the URL in your browser, and store it as `TWITCH_OAUTH_TOKEN` in `.env` (the URL will be something like `xxxx.twitch.tv?xxxxx&access_token=yyyyyy&blahblah`, you want the "yyyyyy" portion).
1. Save your `.env` file.

**Upload Bot to Heroku**
1. Download and install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli).
1. Open a command prompt on your PC.
1. cd to the directory where you cloned this repo.
1. Type `heroku login` and follow the prompts.
1. Type `heroku git:remote -a APPNAME` where `APPNAME` is the name you gave your Heroku app.
1. Type `git push heroku master` and let it run.
1. Type `heroku scale web=0 worker=1`

**Invite the Bot to your Discord Server**
1. Go to `https://discord.com/api/oauth2/authorize?client_id=BOT_CLIENT_ID&permissions=8&scope=bot` (Swap `BOT_CLIENT_ID` in the URL above for your [Discord app's client id](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).)
	* Ensure that, at minimum, the bot has Send Messages, Manage Messages, and Embed Links in the announce channel.
1. Start by issuing the  `` `channel`` command (`` `channel #live-now``) to tell the bot where to post its messages.
1. Add streamers by issuing `` `add streamer1 streamer2 etc etc``
1. Remove streamers by issuing `` `del streamer1 streamer2 etc etc``
1. List followed streamers by issuing `` `list``
1. Change the bot's command prefix using `` `prefix !`` (this would change the prefix from `` ` `` to `!`)

NOTE: Heroku's free tier by default doesn't give you enough dyno hours to run this bot continously. At the time of writing, however, if you provide them with your billing info (e.g. a credit card) but stay on their free tier, they give you extra free monthly hours, effectively letting you run this bot constantly while still paying nothing. They'll just have your credit card on file in case you decide to upgrade or something like that.
