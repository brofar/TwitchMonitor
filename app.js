/* General */
require('dotenv/config');

/* Local */
const discordBot = require('./discord-bot');
const twitchBot = require('./twitch-monitor');
const log = require('./log');


(async function() {
    log.log('Bot Starting.');

    let bot = new discordBot();
    await bot.init();

    let twitch = new twitchBot((streamers) => {
        bot.UpdateWatchStatus(streamers.length);
        bot.ProcessStreams(streamers);
    });

    twitch.Start();
})();
