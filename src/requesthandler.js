// requesthandler contains helper routines to call providers and return HTTP results
//
// exports:
//   checkJwt: middleware for checking javascript web token
//   processUser: middleware for processing an incoming user

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const environment = require('./environment');

// import the auth config based on the environment
const auth0Config = environment.getConfig(environment.auth0);

// Create middleware for checking the JWT
exports.checkJwt = jwt({
  // Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer
  audience: auth0Config.audience, 
  issuer: `https://${auth0Config.domain}/`,
  algorithms: [ 'RS256' ]
});
  
// create middleware that will log all requests
exports.logRequest = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};