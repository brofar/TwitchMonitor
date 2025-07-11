/* General */
const Dotenv = require('dotenv').config();
const postgres = require('postgres');

/* Local */
const log = require('./log');
const Migration = require('./migration');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

const className = '[db]';

class db {
  /**
   * Set up the DB for the first time.
   */
  static async Init() {
    // Check if we need to migrate from old database structure
    const needsMigration = await Migration.needsMigration();
    
    if (needsMigration) {
      log.log(className, `Running database migration...`);
      const migrationSuccessful = await Migration.migrate();
      
      if (!migrationSuccessful) {
        log.error(className, `Database migration failed. Please check the logs and try again.`);
        process.exit(1);
      }
      
      // Clean up backup tables after successful migration
      await Migration.cleanupBackups();
      log.log(className, `Database migration completed successfully.`);
    }

    // Check if DB tables exist.
    log.log(className, `Checking for tables.`);
    const tableExists = await sql`SELECT to_regclass('public.livemessages');`
    let result = tableExists[0].to_regclass;
    console.log(result);

    if (result === null) {
      // If they don't exist, create them.
      log.log(className, `Tables don't exist, creating.`);
      const livemessages = await sql`CREATE TABLE IF NOT EXISTS livemessages (
                guildid VARCHAR(60) NOT NULL,
                channelid VARCHAR(60) NOT NULL,
                messageid VARCHAR(60) NOT NULL,
                streamer VARCHAR(60) NOT NULL,
                PRIMARY KEY (guildId, channelId, messageId, streamer)
            );`
      const monitor = await sql`CREATE TABLE IF NOT EXISTS monitor (
                guildid VARCHAR(60) NOT NULL,
                channelid VARCHAR(60) NOT NULL,
                roleid VARCHAR(60) NOT NULL,
                streamer VARCHAR(60) NOT NULL,
                PRIMARY KEY (guildId, channelId, streamer)
            );`
    }
    return Promise.resolve();
  }

  /**
   * Get distinct channel names from the database.
   */
  static async GetChannels() {
    const users = await sql`SELECT DISTINCT streamer FROM monitor`

    // Transform the result into an array of values
    let result = users.map(a => a.streamer);

    return Promise.resolve(result);
  }

  /**
   * Get all the discord messages from the db.
   */
  static async GetMessages() {
    const messages = await sql`SELECT * FROM livemessages`
    return Promise.resolve(messages);
  }

  /**
   * Delete messages from the DB
   */
  static async DeleteMessage(guildId, messageId) {
    await sql`DELETE FROM livemessages WHERE guildid = ${guildId} AND messageid = ${messageId}`
    return Promise.resolve();
  }

  static async AddMessage(guildId, channelId, messageId, streamer) {
    try {
      await sql`INSERT INTO livemessages (guildid, channelid, messageid, streamer) VALUES (${guildId}, ${channelId}, ${messageId}, ${streamer}) ON CONFLICT DO NOTHING`;
    } catch (e) {
      log.warn(className, `Couldn't create a new message config for ${streamer} in ${guildId}.`);
      console.warn(e);
    }
    return Promise.resolve();
  }

  static async GetGuildsPerStreamer(streamerArray) {
    const streamers = await sql`SELECT * FROM monitor WHERE streamer IN  ${sql(streamerArray)}`
    return Promise.resolve(streamers);
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
    return Promise.resolve();
  }

  /**
   * Add a streamer to a guild
   */
  static async AddStreamers(streamers) {
    let results = { added: [], skipped: [] };
    
    try {
      // Check for existing entries first
      for (const streamer of streamers) {
        const existing = await sql`SELECT * FROM monitor WHERE guildid = ${streamer.guildid} AND channelid = ${streamer.channelid} AND streamer = ${streamer.streamer}`;
        if (existing.length > 0) {
          results.skipped.push(streamer.streamer);
        } else {
          results.added.push(streamer.streamer);
        }
      }
      
      // Only insert the new ones
      if (results.added.length > 0) {
        const toInsert = streamers.filter(s => results.added.includes(s.streamer));
        await sql`INSERT INTO monitor ${sql(toInsert, 'guildid', 'channelid', 'roleid', 'streamer')}`;
      }
    } catch (e) {
      log.warn(className, `Couldn't add streamers.`);
      console.warn(e);
    }
    return Promise.resolve(results);
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
    return Promise.resolve();
  }

  /**
   * List watched streamers from a guild.
   */
  static async ListStreamers(guildId) {
    const streamers = await sql`SELECT streamer, channelid, roleid FROM monitor WHERE guildid = ${guildId}`

    return Promise.resolve(streamers);
  }
}

module.exports = db;