// auth0 management API utility functions

// exports:
//   getAPIAccessToken(): get access token for SnapMaster API (used to communicate to providers)

const axios = require('axios');
const environment = require('./environment');
const auth0Config = environment.getConfig(environment.auth0);

// get a SnapMaster API access token
exports.getAPIAccessToken = async () => {
  try {
    const url = `https://${auth0Config.domain}/oauth/token`;
    const headers = { 'content-type': 'application/json' };
    const body = { 
      client_id: auth0Config.client_id,
      client_secret: auth0Config.client_secret,
      audience: `https://api.snapmaster.io`,
      grant_type: 'client_credentials'
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });
    const data = response.data;
    if (data && data.access_token) {
      return data.access_token;
    }
    return null;
  } catch (error) {
    await error.response;
    console.log(`getAPIAccessToken: caught exception: ${error}`);
    return null;
  }
}