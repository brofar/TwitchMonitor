/* General */
require('dotenv/config');

/* Local */
const log = require('./log');

/**
 * Twitch Helix API helper ("New Twitch API").
 */
const className = '[Twitch-API]';
const HELIX = 'https://api.twitch.tv/helix';

let oauthToken = '';

/**
 * Fetch JSON, throwing with the Helix error message attached on non-2xx.
 */
async function request(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ? `${body.message} (${body.error}/${res.status})` : `HTTP ${res.status}`);
  }

  return body;
}

class TwitchApi {
  /** Token Generation
   * "Any third-party app that calls the Twitch APIs and maintains an OAuth
   * session must call the /validate endpoint to verify that the access
   * token is still valid." - Twitch
   */
  static async ValidateToken() {
    log.log(className, `Validating Twitch Token.`);
    try {
      await request('https://id.twitch.tv/oauth2/validate', {
        headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${oauthToken}` }
      });
      log.log(className, `Twitch token is valid.`);
      return true;
    } catch (err) {
      log.log(className, `Twitch token NOT valid:`, err.message);
      return false;
    }
  }

  static async GetTwitchToken() {
    if (await this.ValidateToken()) return oauthToken;

    log.log(className, `Getting a new Twitch Token.`);
    const data = await request('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    oauthToken = data.access_token;
    return oauthToken;
  }

  /**
   * @param {string[]}  channelNames  Array of channel names to check.
   * @return {Promise<object[]>}  Array of stream information.
   */
  static FetchStreams(channelNames) {
    return this.GetTwitchData('/streams', 'user_login', channelNames);
  }

  static FetchUsers(channelNames) {
    return this.GetTwitchData('/users', 'login', channelNames);
  }

  /**
   * Queries Twitch, 100 values per request (their per-call maximum).
   *
   * @param {string}    path        Helix path to query, e.g. '/streams'.
   * @param {string}    paramName   The url parameter's name.
   * @param {string[]}  paramValues The values of the parameter.
   *
   * @return {Promise<object[]>}  Concatenated results across all requests.
   */
  static async GetTwitchData(path, paramName, paramValues) {
    if (!paramValues.length) return [];

    const headers = {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await this.GetTwitchToken()}`
    };
    const results = [];

    for (let i = 0; i < paramValues.length; i += 100) {
      const params = new URLSearchParams(paramValues.slice(i, i + 100).map(v => [paramName, v]));
      log.log(className, `Calling Twitch${path}`);
      const body = await request(`${HELIX}${path}?${params}`, { headers });
      results.push(...(body.data || []));
    }

    return results;
  }
}

module.exports = TwitchApi;
