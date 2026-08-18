/* General */
require('dotenv/config');
const postgres = require('postgres');

/* Local */
const log = require('./log');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

const className = '[db]';

class db {
  /**
   * Set up the DB for the first time.
   */
  static async Init() {
    log.log(className, `Checking for tables.`);

    await sql`CREATE TABLE IF NOT EXISTS livemessages (
              guildid VARCHAR(60) NOT NULL,
              channelid VARCHAR(60) NOT NULL,
              messageid VARCHAR(60) NOT NULL,
              streamer VARCHAR(60) NOT NULL,
              PRIMARY KEY (guildId, channelId, messageId, streamer)
          )`;
    await sql`CREATE TABLE IF NOT EXISTS monitor (
              guildid VARCHAR(60) NOT NULL,
              channelid VARCHAR(60) NOT NULL,
              roleid VARCHAR(60),
              streamer VARCHAR(60) NOT NULL,
              PRIMARY KEY (guildId, channelId, streamer)
          )`;
  }

  /**
   * Get distinct channel names from the database.
   */
  static async GetChannels() {
    const users = await sql`SELECT DISTINCT streamer FROM monitor`;
    return users.map(a => a.streamer);
  }

  /**
   * Get all the discord messages from the db.
   */
  static async GetMessages() {
    return sql`SELECT * FROM livemessages`;
  }

  /**
   * Delete messages from the DB
   */
  static async DeleteMessage(guildId, messageId) {
    await sql`DELETE FROM livemessages WHERE guildid = ${guildId} AND messageid = ${messageId}`;
  }

  static async AddMessage(guildId, channelId, messageId, streamer) {
    try {
      await sql`INSERT INTO livemessages (guildid, channelid, messageid, streamer) VALUES (${guildId}, ${channelId}, ${messageId}, ${streamer}) ON CONFLICT DO NOTHING`;
    } catch (e) {
      log.warn(className, `Couldn't create a new message config for ${streamer} in ${guildId}.`);
      console.warn(e);
    }
  }

  static async GetGuildsPerStreamer(streamerArray) {
    return sql`SELECT * FROM monitor WHERE streamer IN ${sql(streamerArray)}`;
  }

  /**
   * Distinct (guild, channel) pairs currently configured for announcements.
   */
  static async GetMonitoredChannels() {
    return sql`SELECT DISTINCT guildid, channelid FROM monitor`;
  }

  /**
   * Removes a config for a guild
   */
  static async KillGuild(guildId) {
    try {
      await sql`DELETE FROM monitor WHERE guildId = ${guildId}`;
      await sql`DELETE FROM livemessages WHERE guildId = ${guildId}`;
    } catch (e) {
      log.warn(className, `Couldn't remove guild config for ${guildId}.`);
    }
  }

  /**
   * Add streamers to a guild. The primary key decides what's a duplicate, so
   * RETURNING tells us which rows actually landed - anything missing was already there.
   */
  static async AddStreamers(streamers) {
    if (!streamers.length) return { added: [], skipped: [] };

    try {
      const inserted = await sql`
        INSERT INTO monitor ${sql(streamers, 'guildid', 'channelid', 'roleid', 'streamer')}
        ON CONFLICT DO NOTHING
        RETURNING streamer`;

      const added = inserted.map(row => row.streamer);
      return { added, skipped: streamers.map(s => s.streamer).filter(s => !added.includes(s)) };
    } catch (e) {
      log.warn(className, `Couldn't add streamers.`);
      console.warn(e);
      return { added: [], skipped: [] };
    }
  }

  /**
   * Remove a streamer from a guild
   */
  static async RemStreamer(guildId, streamer) {
    try {
      await sql`DELETE FROM monitor WHERE streamer = ${streamer} AND guildid = ${guildId}`;
    } catch (e) {
      log.warn(className, `Couldn't delete streamers from ${guildId}.`);
      console.warn(e);
    }
  }

  /**
   * List watched streamers from a guild.
   */
  static async ListStreamers(guildId) {
    return sql`SELECT streamer, channelid, roleid FROM monitor WHERE guildid = ${guildId}`;
  }
}

module.exports = db;
