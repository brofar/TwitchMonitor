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
  constructor() {
    this.oauthToken = "";
  }

  static async RequestOptions() {
    // Get the oauth token.
    let oauthBearer = await this.GetTwitchToken();

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

  /** Token Generation
   * "Any third-party app that calls the Twitch APIs and maintains an OAuth 
   * session must call the /validate endpoint to verify that the access 
   * token is still valid." - Twitch
   */
  static async ValidateToken() {
    log.log(className, `Validating Twitch Token.`);
    return new Promise((resolve, reject) => {
      let url = "https://id.twitch.tv/oauth2/validate";
      let opt = {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${this.oauthToken}`
        }
      };

      axios.get(url, opt)
        .then(res => {
          log.log(className, `Twitch token is valid.`);
          resolve(true);
        })
        .catch(err => {
          log.log(className, `Twitch token NOT valid.`);
          this.HandleApiError(err);
          resolve(false);
        })
    });
  }

  static GetToken() {
    log.log(className, `Getting a new Twitch Token.`);
    return new Promise((resolve, reject) => {
      axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
        .then(res => {
          let data = res.data;
          log.log(className, `Got Token: ${data.access_token}.`);
          resolve(data.access_token);
        })
        .catch(err => {
          this.HandleApiError(err);
          reject(err);
        });
    });
  }

  static GetTwitchToken() {
    return new Promise(async (resolve, reject) => {
      // Validate our token against Twitch.
      let valid = await this.ValidateToken();

      if (valid === false) {
        // If our token isn't valid, get a new one.
        this.oauthToken = await this.GetToken();
      }

      resolve(this.oauthToken);
    });
  }

  /**
   * Queries Twitch for Stream info.
   * 
   * Twitch only allows requests for 100 users at a time. Recurses through
   * to retrieve all stream info.
   *
   * @param {string[]}   gameId  Game id to check.
   *
   * @return {string[]}  Array of stream information.
   */
  static FetchStreamsByGame(gameId) {
    return new Promise((resolve, reject) => {
      let baseUrl = `/streams`;
      this.GetTwitchData(baseUrl, "game_id", gameId, [], resolve, reject);
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
  static async GetTwitchData(baseUrl, paramName, paramValues, twitchData, resolve, reject) {

    log.log(className, `Calling Twitch${baseUrl}`);

    // Grab first 100 entries
    let firstHundredValues = paramValues.slice(0, 100);

    // Remainder of entries
    let remainingValues = paramValues.slice(100)

    // Add parameters to the base URL
    let url = `${baseUrl}?${paramName}=${firstHundredValues.join(`&${paramName}=`)}`;

    let opt = await this.RequestOptions();

    axios.get(url, opt)
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