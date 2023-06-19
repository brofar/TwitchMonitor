/* General */
const Dotenv = require('dotenv').config();
const axios = require('axios');

/* Local */
const discordBot = require('./discord-bot');
const twitchBot = require('./twitch-monitor');
const log = require('./log');


(async function() {
    log.log('FF8 Bot Starting.');

    let bot = new discordBot();
    await bot.init();

    let twitch = new twitchBot();

    twitch.on('streamer-refresh', (streamers) => {
        bot.ProcessStreams(streamers);
    });
    
    twitch.Start();
})();