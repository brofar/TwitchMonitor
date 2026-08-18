/**
 * Parse the space-separated streamer list from a slash command option.
 * Lowercases, strips a leading '@', drops blanks, and separates out anything
 * too long to be a Twitch account.
 *
 * @param {string} input  Raw option value.
 * @return {{names: string[], invalid: string[]}}
 */
module.exports = function parseNames(input) {
  const names = [];
  const invalid = [];

  for (const raw of input.split(' ')) {
    const name = raw.trim().toLowerCase().replace(/^@/, '');

    if (!name.length) continue;
    if (name.length > 30) invalid.push(name);
    else names.push(name);
  }

  return { names, invalid };
};
