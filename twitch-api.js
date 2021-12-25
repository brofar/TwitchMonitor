/* General */
const Dotenv = require('dotenv').config();
const axios = require('axios');

/* Local */
const log = require('./log');

/**
 * Twitch Helix API helper ("New Twitch API").
 */
const className = '[Twitch-API]';

class TwitchApi {
  static get requestOptions() {
    // Automatically remove "oauth:" prefix if it's present
    const oauthPrefix = "oauth:";
    let oauthBearer = process.env.TWITCH_OAUTH_TOKEN;
    if (oauthBearer.startsWith(oauthPrefix)) {
      oauthBearer = oauthBearer.substr(oauthPrefix.length);
    }
    // Construct default request options
    return {
      baseURL: "https://api.twitch.tv/helix/",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${oauthBearer}`
      }
    };
  }

  static HandleApiError(err) {
    const res = err.response || {};

    if (res.data && res.data.message) {
      log.error(className, 'API request failed with Helix error:', res.data.message, `(${res.data.error}/${res.data.status})`);
    } else {
      log.error(className, 'API request failed with error:', err.message || err);
    }
  }

  /**
   * Queries Twitch for Stream info.
   * 
   * Twitch only allows requests for 100 users at a time. Recurses through
   * to retrieve all stream info.
   *
   * @param {string[]}   channelNames  Array of channel names to check.
   * @param {string[]}   [streamData]  Array of results (for recursion).
   *
   * @return {string[]}  Array of stream information.
   */
  static FetchStreams(channelNames) {
    return new Promise((resolve, reject) => {
      let baseUrl = `/streams`;
      this.GetTwitchData(baseUrl, "user_login", channelNames, [], resolve, reject);
    });
  }

  static FetchUsers(channelNames) {
    return new Promise((resolve, reject) => {
      let baseUrl = `/users`;
      this.GetTwitchData(baseUrl, "login", channelNames, [], resolve, reject);
    });
  }

  static FetchGames(gameIds) {
    return new Promise((resolve, reject) => {
      let baseUrl = `/games`;
      this.GetTwitchData(baseUrl, "id", gameIds, [], resolve, reject);
    });
  }

  /**
   * Recursively queries Twitch for info.
   * 
   * Twitch only allows requests for 100 objects at a time. Recurses
   * through to retrieve all info.
   * 
   * https://itnext.io/how-to-get-resources-from-paginated-rest-api-d7c20fe2bb0b
   *
   * @param {string}    baseUrl     Base URL to query.
   * @param {string}    paramName   The url parameter's name.
   * @param {string[]}  paramValues The values of the parameter.
   * @param {string[]}  twitchData  Array of results (for recursion).
   * @param {method}    resolve     Promise.resolve method.
   * @param {method}    reject      Promise.reject method.
   *
   * @return {string[]}  Array of stream information.
   */
  static GetTwitchData(baseUrl, paramName, paramValues, twitchData, resolve, reject) {

    log.log(className, `Calling Twitch${baseUrl}`);

    // Grab first 100 entries
    let firstHundredValues = paramValues.slice(0, 100);

    // Remainder of entries
    let remainingValues = paramValues.slice(100)

    // Add parameters to the base URL
    let url = `${baseUrl}?${paramName}=${firstHundredValues.join(`&${paramName}=`)}`;

    axios.get(url, this.requestOptions)
      .then(res => {
        const retrivedInfo = twitchData.concat(res.data.data || []);

        // If we still have remaining values to query, recurse.
        if (remainingValues.length > 0) {
          this.GetTwitchData(baseUrl, paramName, remainingValues, retrivedInfo, resolve, reject)
        } else {
          resolve(retrivedInfo)
        }
      })
      .catch(err => {
        this.HandleApiError(err);
        reject(err);
      })
  }
}

module.exports = TwitchApi;