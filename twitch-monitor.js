/* General */
const EventEmitter = require('events');

/* Local */
const log = require('./log');
const db = require('./db');
const TwitchApi = require('./twitch-api');

const gameId = 11282; //FF8
//                  speedrun
const targetTags = ['7cefbf30-4c3e-4aa7-99cd-70aabb662f27'];

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
                if (streams.length > 0) {
                    // Get profile pictures for only our online users who have at least one of the required tags
                    console.log(streams);
                    let speedrunners = streams.filter(element => element.tag_ids.some(r => targetTags.includes(r)));
                    console.log("---------------------------------------------");
                    console.log(speedrunners);
                    let usernames = speedrunners.map(a => a.user_login);
                    let users = await TwitchApi.FetchUsers(usernames);

                    // Merge the user's profile pic into their stream object.
                    for (const user of users) {
                        const index = streams.findIndex(element => element.user_id == user.id);
                        if (index !== -1)
                            streams[index].profile_image_url = user.profile_image_url;
                    }
                }
                this.emit('streamer-refresh', streams);
            })
            .catch((err) => {
                log.warn(this.className, 'Error in users refresh:', err);
            })
    }
}

module.exports = Twitch;