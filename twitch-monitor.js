/* General */
const EventEmitter = require('events');

/* Local */
const log = require('./log');
const db = require('./db');
const TwitchApi = require('./twitch-api');

const gameId = [11282, 514788, 1736914392]; //FF8

// Lowercase tags here.
const targetTags = ['speedrun', 'speedrunning'];

// Pull distinct watched channels from DB
// Check Twitch for online status every x ms

class Twitch extends EventEmitter {
    constructor() {
        super();
        this.className = '[Twitch-Monitor]';
        this._lastRefresh = null;
    }

    Start() {
        let checkIntervalMs = parseInt(process.env.TWITCH_CHECK_INTERVAL_MS);

        // Refresh immediately upon run
        this.Refresh();

        setInterval(() => {
            this.Refresh();
        }, checkIntervalMs);
    }

    async Refresh() {
        log.log(this.className, `Polling channels.`);

        // Get the results from Twitch
        TwitchApi.FetchStreamsByGame(gameId)
            .then(async (streams) => {
                log.log(this.className, `Found ${streams.length} FF8 Stream(s).`);
                if(streams.length > 0) {
                    log.log(this.className, `DEBUG.`);
                    console.log(streams[0]);
                    log.log(this.className, `/DEBUG.`);
                }
                let speedStreams = streams.filter(element => element["tags"].some(r => targetTags.includes(r.toLowerCase())));
                log.log(this.className, `Found ${speedStreams.length} FF8 Stream(s) with the speedrun tag.`);
                if (speedStreams.length > 0) {
                    // Get profile pictures for only our online users who have at least one of the required tags
                    let usernames = speedStreams.map(a => a.user_login);
                    let users = await TwitchApi.FetchUsers(usernames);

                    // Merge the user's profile pic into their stream object.
                    for (const user of users) {
                        const index = speedStreams.findIndex(element => element.user_id == user.id);
                        if (index !== -1)
                        speedStreams[index].profile_image_url = user.profile_image_url;
                    }
                }
                this.emit('streamer-refresh', speedStreams);
            })
            .catch((err) => {
                log.warn(this.className, 'Error in users refresh:', err);
            })
    }
}

module.exports = Twitch;