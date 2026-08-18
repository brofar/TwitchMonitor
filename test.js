/*
 * Self-check for the bits with real branching. Run with `npm test`.
 */
process.env.LOG_LEVEL = '0'; // quiet, and must be set before ./log is required

const assert = require('node:assert');
const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');

const log = require('./log');
const parseNames = require('./commands/_names');
const commands = require('./load-commands');
const db = require('./db');
const Bot = require('./discord-bot');
const TwitchApi = require('./twitch-api');

/* ---- parseNames ---- */

assert.deepStrictEqual(parseNames('Alice @Bob  bob').names, ['alice', 'bob', 'bob']);
assert.deepStrictEqual(parseNames('   ').names, []);
assert.deepStrictEqual(parseNames('@').names, []);

const long = 'x'.repeat(31);
assert.deepStrictEqual(parseNames(`ok ${long}`), { names: ['ok'], invalid: [long] });

/* ---- Command loading ---- */

assert.ok(commands.length >= 4, `expected the commands to load, got ${commands.length}`);
for (const command of commands) {
  const json = command.data.toJSON();
  assert.strictEqual(typeof command.execute, 'function');
  assert.ok(json.name, 'command is missing a name');

  // Commands reconfigure the whole server, so none of them may ship without the
  // Manage Guild gate. The runtime re-check in discord-bot.js backs this up.
  assert.strictEqual(
    json.default_member_permissions,
    PermissionFlagsBits.ManageGuild.toString(),
    `/${json.name} is missing setDefaultMemberPermissions(ManageGuild)`
  );
}

/* ---- Permission reporting (admin.js `servers`) ---- */

const perms = (...names) => new PermissionsBitField(names.map(n => PermissionFlagsBits[n]));

assert.strictEqual(Bot.DescribePerms(perms('ViewChannel', 'SendMessages', 'EmbedLinks')), 'OK');
assert.strictEqual(Bot.DescribePerms(perms('ViewChannel', 'SendMessages')), 'MISSING EmbedLinks');
assert.strictEqual(Bot.DescribePerms(perms('ViewChannel')), 'MISSING SendMessages, EmbedLinks');
assert.strictEqual(Bot.DescribePerms(null), 'unknown', 'an uncached bot member must not read as OK');
assert.strictEqual(
  Bot.DescribePerms(perms('ViewChannel', 'SendMessages', 'EmbedLinks', 'MentionEveryone')),
  'OK (+MentionEveryone)'
);
// Administrator short-circuits has(), so it covers everything.
assert.strictEqual(Bot.DescribePerms(perms('Administrator')), 'OK (+ManageMessages, MentionEveryone)');

/* ---- ProcessStreams routing ----
 * Swaps the db reads and the three Discord-touching methods for recorders, so
 * this exercises the delete/update/send decision itself and nothing else.
 */
function routingBot(messages, monitorList) {
  db.GetMessages = async () => messages;
  db.GetGuildsPerStreamer = async () => monitorList;

  const bot = new Bot();
  const calls = { deleted: [], updated: [], sent: [] };

  bot.DeleteMessages = async (msgs) => calls.deleted.push(...msgs);
  bot.UpdateMessage = async (g, c, m, r, s) => calls.updated.push(`${g}/${c}/${m}/${s.user_login}`);
  bot.SendLiveMessage = async (g, c, r, s) => calls.sent.push(`${g}/${c}/${s.user_login}`);

  return { bot, calls };
}

const live = (login) => ({ user_login: login, user_name: login });
const watch = (guildid, channelid, streamer) => ({ guildid, channelid, roleid: null, streamer });
const posted = (guildid, channelid, messageid, streamer) => ({ guildid, channelid, messageid, streamer });

async function testRouting() {
  // Offline AND dropped from the watch list matches both cleanup filters. It must
  // still only be deleted once - deleting twice is what produced the 10008 errors.
  {
    const { bot, calls } = routingBot([posted('g1', 'c1', 'm1', 'alice')], []);
    await bot.ProcessStreams([]);
    assert.strictEqual(calls.deleted.length, 1, 'offline + unwatched must delete once, not twice');
    assert.strictEqual(calls.sent.length + calls.updated.length, 0);
  }

  // Still live and still watched: edit the card in place, never repost it.
  {
    const { bot, calls } = routingBot(
      [posted('g1', 'c1', 'm1', 'bob')],
      [watch('g1', 'c1', 'bob')]
    );
    await bot.ProcessStreams([live('bob')]);
    assert.deepStrictEqual(calls.updated, ['g1/c1/m1/bob']);
    assert.deepStrictEqual(calls.deleted, []);
    assert.deepStrictEqual(calls.sent, []);
  }

  // Live, watched, nothing posted yet: send.
  {
    const { bot, calls } = routingBot([], [watch('g1', 'c1', 'carol')]);
    await bot.ProcessStreams([live('carol')]);
    assert.deepStrictEqual(calls.sent, ['g1/c1/carol']);
    assert.deepStrictEqual(calls.deleted, []);
  }

  // One streamer announced in two channels of the same guild gets two cards.
  {
    const { bot, calls } = routingBot([], [watch('g1', 'c1', 'dave'), watch('g1', 'c2', 'dave')]);
    await bot.ProcessStreams([live('dave')]);
    assert.deepStrictEqual(calls.sent.sort(), ['g1/c1/dave', 'g1/c2/dave']);
  }

  // A card in a channel the streamer is no longer watched in is deleted, while
  // the channel that still watches them is updated.
  {
    const { bot, calls } = routingBot(
      [posted('g1', 'c1', 'm1', 'erin'), posted('g1', 'c2', 'm2', 'erin')],
      [watch('g1', 'c1', 'erin')]
    );
    await bot.ProcessStreams([live('erin')]);
    assert.deepStrictEqual(calls.deleted.map(m => m.messageid), ['m2']);
    assert.deepStrictEqual(calls.updated, ['g1/c1/m1/erin']);
  }
}

/* ---- Twitch batching ----
 * Twitch caps a query at 100 values, so GetTwitchData pages through them. Stub
 * fetch and check the pages come out 100/100/50 and concatenate in order.
 */
async function testBatching() {
  const names = Array.from({ length: 250 }, (_, i) => `user${i}`);
  const urls = [];
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    urls.push(url);
    const logins = new URL(url).searchParams.getAll('user_login');
    return { ok: true, json: async () => ({ data: logins.map(user_login => ({ user_login })) }) };
  };

  try {
    const streams = await TwitchApi.FetchStreams(names);
    const pages = urls.filter(u => u.includes('/helix/'))
      .map(u => new URL(u).searchParams.getAll('user_login').length);

    assert.deepStrictEqual(pages, [100, 100, 50], 'should page 250 names into 3 requests');
    assert.deepStrictEqual(streams.map(s => s.user_login), names, 'results should concatenate in order');
  } finally {
    globalThis.fetch = realFetch;
  }

  // An empty channel list must not hit Twitch at all.
  const before = urls.length;
  globalThis.fetch = async (url) => { urls.push(url); throw new Error('should not be called'); };
  try {
    assert.deepStrictEqual(await TwitchApi.FetchStreams([]), []);
    assert.strictEqual(urls.length, before, 'no names means no requests');
  } finally {
    globalThis.fetch = realFetch;
  }
}

/* ---- ListGuilds reporting ----
 * Drives the real method against a fake client, so the per-channel walk and the
 * missing-channel branch are covered rather than just DescribePerms in isolation.
 */
async function testListGuilds() {
  const channel = (name, ...allowed) => ({ name, permissionsFor: () => perms(...allowed) });
  const guild = {
    id: 'g1', name: 'Test Server', memberCount: 3,
    members: { me: { permissions: perms('ViewChannel', 'SendMessages', 'EmbedLinks') } },
    channels: { cache: new Map([['c1', channel('general', 'ViewChannel', 'SendMessages')]]) }
  };

  db.GetMonitoredChannels = async () => [
    { guildid: 'g1', channelid: 'c1' },
    { guildid: 'g1', channelid: 'c-deleted' }
  ];

  const bot = new Bot();
  bot.client = { guilds: { cache: new Map([['g1', guild]]) } };

  const lines = [];
  const realLog = log.log;
  log.log = (...args) => lines.push(args.join(' '));
  try {
    await bot.ListGuilds();
  } finally {
    log.log = realLog;
  }

  const out = lines.join('\n');
  assert.match(out, /In 1 server:/);
  assert.match(out, /g1\s+Test Server \(3 members\)/);
  assert.match(out, /server-wide: OK/);
  // EmbedLinks is granted server-wide but denied by a channel overwrite.
  assert.match(out, /#general: MISSING EmbedLinks/);
  assert.match(out, /c-deleted: configured but no longer exists/);
}

(async () => {
  await testRouting();
  await testBatching();
  await testListGuilds();
  console.log(`OK - ${commands.length} commands, routing and batching checks passed.`);
})();
