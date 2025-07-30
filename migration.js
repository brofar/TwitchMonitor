/* General */
const Dotenv = require('dotenv').config();
const postgres = require('postgres');

/* Local */
const log = require('./log');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: false,
});

const className = '[migration]';

class Migration {
  /**
   * Check if we need to migrate from old database structure
   */
  static async needsMigration() {
    try {
      // Check if the old config table exists
      const configTableExists = await sql`SELECT to_regclass('public.config');`
      const configExists = configTableExists[0].to_regclass !== null;

      if (!configExists) {
        // No old config table, check if monitor table needs message column
        return await this.needsMessageColumnMigration();
      }

      // Check if the monitor table has the old structure (missing channelid and roleid columns)
      const monitorColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'monitor' AND table_schema = 'public'
      `;

      const columnNames = monitorColumns.map(col => col.column_name);
      const hasOldStructure = !columnNames.includes('channelid') || !columnNames.includes('roleid');

      if (hasOldStructure) {
        log.log(className, `Old database structure detected, migration needed.`);
        return true;
      }

      // Check if we need to add the message column
      return await this.needsMessageColumnMigration();
    } catch (error) {
      log.error(className, `Error checking migration status:`, error);
      return false;
    }
  }

  /**
   * Check if we need to add the message column to the monitor table
   */
  static async needsMessageColumnMigration() {
    try {
      const monitorColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'monitor' AND table_schema = 'public'
      `;

      const columnNames = monitorColumns.map(col => col.column_name);
      const needsMessageColumn = !columnNames.includes('message');

      if (needsMessageColumn) {
        log.log(className, `Monitor table missing message column, migration needed.`);
        return true;
      }

      log.log(className, `Database structure is current, no migration needed.`);
      return false;
    } catch (error) {
      log.error(className, `Error checking message column migration status:`, error);
      return false;
    }
  }

  /**
   * Perform the migration from old structure to new structure
   */
  static async migrate() {
    try {
      log.log(className, `Starting database migration...`);

      // Check what type of migration we need
      const configTableExists = await sql`SELECT to_regclass('public.config');`
      const configExists = configTableExists[0].to_regclass !== null;

      if (configExists) {
        // Full migration from old structure
        return await this.migrateFromOldStructure();
      } else {
        // Just add message column
        return await this.addMessageColumn();
      }
    } catch (error) {
      log.error(className, `Migration failed:`, error);
      return false;
    }
  }

  /**
   * Migrate from old database structure with config table
   */
  static async migrateFromOldStructure() {
    try {
      // Step 1: Get all data from old tables
      const configData = await sql`SELECT * FROM config`;
      const oldMonitorData = await sql`SELECT * FROM monitor`;

      log.log(className, `Found ${configData.length} config entries and ${oldMonitorData.length} monitor entries.`);

      // Step 2: Create backup tables
      await sql`CREATE TABLE IF NOT EXISTS config_backup AS SELECT * FROM config`;
      await sql`CREATE TABLE IF NOT EXISTS monitor_backup AS SELECT * FROM monitor`;
      log.log(className, `Created backup tables.`);

      // Step 3: Drop old tables
      await sql`DROP TABLE IF EXISTS config`;
      await sql`DROP TABLE IF EXISTS monitor`;
      log.log(className, `Dropped old tables.`);

      // Step 4: Create new monitor table with updated structure including message column
      await sql`CREATE TABLE IF NOT EXISTS monitor (
        guildid VARCHAR(60) NOT NULL,
        channelid VARCHAR(60) NOT NULL,
        roleid VARCHAR(60),
        message TEXT,
        streamer VARCHAR(60) NOT NULL,
        PRIMARY KEY (guildId, channelId, streamer)
      )`;
      log.log(className, `Created new monitor table with message column.`);

      // Step 5: Migrate data from old structure to new structure
      let migratedEntries = 0;
      for (const configEntry of configData) {
        const { guildid, channelid } = configEntry;
        
        // Find all streamers that were being watched in this guild
        const guildStreamers = oldMonitorData.filter(monitor => monitor.guildid === guildid);
        
        // Insert each streamer with the guild's configured channel
        for (const streamer of guildStreamers) {
          await sql`INSERT INTO monitor (guildid, channelid, roleid, message, streamer) 
                   VALUES (${guildid}, ${channelid}, NULL, NULL, ${streamer.streamer})`;
          migratedEntries++;
        }
      }

      log.log(className, `Migrated ${migratedEntries} entries to new structure.`);

      // Step 6: Clean up any orphaned monitor entries (guilds without config)
      const orphanedMonitors = oldMonitorData.filter(monitor => 
        !configData.find(config => config.guildid === monitor.guildid)
      );

      if (orphanedMonitors.length > 0) {
        log.warn(className, `Found ${orphanedMonitors.length} orphaned monitor entries (guilds without config). These will be skipped.`);
        for (const orphan of orphanedMonitors) {
          log.warn(className, `Orphaned entry: Guild ${orphan.guildid}, Streamer ${orphan.streamer}`);
        }
      }

      log.log(className, `Migration from old structure completed successfully!`);
      return true;

    } catch (error) {
      log.error(className, `Migration from old structure failed:`, error);
      
      // Attempt to restore from backup
      try {
        log.log(className, `Attempting to restore from backup...`);
        await sql`DROP TABLE IF EXISTS config`;
        await sql`DROP TABLE IF EXISTS monitor`;
        await sql`CREATE TABLE config AS SELECT * FROM config_backup`;
        await sql`CREATE TABLE monitor AS SELECT * FROM monitor_backup`;
        await sql`DROP TABLE config_backup`;
        await sql`DROP TABLE monitor_backup`;
        log.log(className, `Restored from backup successfully.`);
      } catch (restoreError) {
        log.error(className, `Failed to restore from backup:`, restoreError);
      }
      
      return false;
    }
  }

  /**
   * Add message column to existing monitor table
   */
  static async addMessageColumn() {
    try {
      log.log(className, `Adding message column to monitor table...`);

      // Check if column already exists (safety check)
      const monitorColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'monitor' AND table_schema = 'public'
      `;

      const columnNames = monitorColumns.map(col => col.column_name);
      
      if (columnNames.includes('message')) {
        log.log(className, `Message column already exists, no migration needed.`);
        return true;
      }

      // Add the message column before the streamer column
      await sql`ALTER TABLE monitor ADD COLUMN message TEXT`;
      
      // PostgreSQL doesn't support positioning columns directly in ALTER TABLE,
      // so we need to recreate the table with the desired column order
      log.log(className, `Reordering columns to place message before streamer...`);
      
      // Create a temporary table with the desired column order
      await sql`CREATE TABLE monitor_temp AS 
        SELECT guildid, channelid, roleid, message, streamer 
        FROM monitor`;
      
      // Drop the original table
      await sql`DROP TABLE monitor`;
      
      // Recreate the table with proper constraints and column order
      await sql`CREATE TABLE monitor (
        guildid VARCHAR(60) NOT NULL,
        channelid VARCHAR(60) NOT NULL,
        roleid VARCHAR(60),
        message TEXT,
        streamer VARCHAR(60) NOT NULL,
        PRIMARY KEY (guildId, channelId, streamer)
      )`;
      
      // Copy data back from temporary table
      await sql`INSERT INTO monitor (guildid, channelid, roleid, message, streamer)
        SELECT guildid, channelid, roleid, message, streamer FROM monitor_temp`;
      
      // Drop the temporary table
      await sql`DROP TABLE monitor_temp`;
      
      log.log(className, `Successfully added message column to monitor table in correct position.`);
      return true;

    } catch (error) {
      log.error(className, `Failed to add message column:`, error);
      return false;
    }
  }

  /**
   * Clean up backup tables after successful migration
   */
  static async cleanupBackups() {
    try {
      await sql`DROP TABLE IF EXISTS config_backup`;
      await sql`DROP TABLE IF EXISTS monitor_backup`;
      log.log(className, `Cleaned up backup tables.`);
    } catch (error) {
      log.warn(className, `Error cleaning up backup tables:`, error);
    }
  }
}

module.exports = Migration;