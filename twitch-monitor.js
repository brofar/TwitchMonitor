/* General */
const EventEmitter = require('events');

/* Local */
const log = require('./log');
const db = require('./db');
const TwitchApi = require('./twitch-api');

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
        // Get channel list
        let channels = await db.GetChannels();

        // Don't waste resources if we're not watching any channels
        if (!channels.length || channels.length == 0) {
            log.warn(this.className, 'No streamers to watch.');
            return;
        }

        log.log(this.className, `Polling ${channels.length} channels.`);

        // Get the results from Twitch
        TwitchApi.FetchStreams(channels)
            .then(async (streams) => {
                if (streams.length > 0) {
                    // Get profile pictures for only our online users
                    let usernames = streams.map(a => a.user_login);
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