/* Local */
const log = require('./log');
const db = require('./db');
const TwitchApi = require('./twitch-api');

// Pull distinct watched channels from DB
// Check Twitch for online status every x ms

class Twitch {
  /**
   * @param {function} onRefresh  Called with the array of live streams each poll.
   */
  constructor(onRefresh) {
    this.className = '[Twitch-Monitor]';
    this.onRefresh = onRefresh;
  }

  Start() {
    let checkIntervalMs = parseInt(process.env.TWITCH_CHECK_INTERVAL_MS);

    // Refresh immediately upon run
    this.Refresh();

    setInterval(() => this.Refresh(), checkIntervalMs);
  }

  async Refresh() {
    // Get channel list
    let channels = await db.GetChannels();

    // Don't waste resources if we're not watching any channels
    if (!channels.length) {
      // But any messages left over from a since-removed streamer still need cleanup.
      let messages = await db.GetMessages();
      if (messages.length > 0) {
        log.log(this.className, `No streamers to watch, but found ${messages.length} stale messages to clean up.`);
        this.onRefresh([]); // Empty array triggers cleanup
      } else {
        log.warn(this.className, 'No streamers to watch.');
      }
      return;
    }

    log.log(this.className, `Polling ${channels.length} channels.`);

    try {
      const streams = await TwitchApi.FetchStreams(channels);

      if (streams.length > 0) {
        // Get profile pictures for only our online users, and merge them in.
        const users = await TwitchApi.FetchUsers(streams.map(s => s.user_login));
        for (const user of users) {
          const stream = streams.find(s => s.user_id == user.id);
          if (stream) stream.profile_image_url = user.profile_image_url;
        }
      }

      this.onRefresh(streams);
    } catch (err) {
      log.warn(this.className, 'Error in users refresh:', err.message);
    }
  }
}

module.exports = Twitch;
