const { OAuth2Client } = require('google-auth-library');
const authClient = new OAuth2Client();

exports.validateJwt = async (token) => {
  try {
    await authClient.verifyIdToken({
      idToken: token,
//    audience: `${environment.getEndpoint()}`,
    });

    // if the call succeeds, validation passed
    return true;
  } catch (error) {
    console.error(`validateJwt: caught exception: ${error}`);
    return false;
  }
}