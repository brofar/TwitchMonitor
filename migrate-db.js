#!/usr/bin/env node

/* 
 * Standalone migration script for Twitch Monitor Bot
 * 
 * This script can be run independently to migrate from the old database structure
 * to the new one that supports per-channel and per-role configuration.
 * 
 * Usage: node migrate-db.js
 */

/* General */
const Dotenv = require('dotenv').config();

/* Local */
const log = require('./log');
const Migration = require('./migration');

async function runMigration() {
  try {
    console.log('='.repeat(50));
    console.log('Twitch Monitor Database Migration Script');
    console.log('='.repeat(50));
    
    const needsMigration = await Migration.needsMigration();
    
    if (!needsMigration) {
      console.log('✅ No migration needed. Your database is already up to date.');
      return;
    }
    
    console.log('⚠️  Old database structure detected.');
    console.log('📋 This will migrate your data from the old structure to the new one.');
    console.log('🔄 The migration will:');
    console.log('   - Create backup tables');
    console.log('   - Migrate streamer configurations to use per-channel settings');
    console.log('   - Update database schema');
    console.log('   - Clean up old tables');
    console.log('');
    
    // In a real scenario, you might want to prompt for confirmation
    // For now, we'll proceed automatically
    console.log('🚀 Starting migration...');
    
    const migrationSuccessful = await Migration.migrate();
    
    if (migrationSuccessful) {
      await Migration.cleanupBackups();
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('📊 Summary:');
      console.log('   - Old config table migrated to new monitor structure');
      console.log('   - All streamer configurations preserved');
      console.log('   - Database schema updated');
      console.log('   - Backup tables cleaned up');
      console.log('');
      console.log('🎉 Your bot is now ready to use the new per-channel and per-role features!');
    } else {
      console.log('❌ Migration failed. Please check the logs for more details.');
      console.log('🔙 The database has been restored to its original state.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
