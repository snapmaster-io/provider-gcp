// simple environment management
// 
// exports:
//   getEnv(): gets the current environment (dev | prod)
//   setEnv(): sets the current environment (dev | prod)
//   getConfig(type): gets the config of type 'type' for the current env (dev | prod)
//   geteEndpoint(): gets the Google Cloud Run endpoint for the current env (dev | prod)
//   getUrl(): gets the URL for the app running in the current env (dev | prod)

var environment;
var devMode;

// constants for environment types
exports.dev = 'dev';
exports.prod = 'prod';

// constants for config types
exports.auth0 = 'auth0';
exports.google = 'google';

const configs = {
  auth0: {
    dev: require(`../config/auth0_config_dev.json`),
    prod: require(`../config/auth0_config_prod.json`)
  },
  /*
  gcp: {
    dev: require(`../config/google_auth_config_dev.json`),
    prod: require(`../config/google_auth_config_prod.json`)
  },
  google: {
    dev: require(`../config/google_auth_config_dev.json`),
    prod: require(`../config/google_auth_config_prod.json`)
  },*/
};

// get the environment (dev or prod)
exports.getEnv = () => environment;

// set the environment (dev or prod)
exports.setEnv = (env) => {
  environment = env;
}

// get devMode state (true or false)
exports.getDevMode = () => devMode;

// set the devMode state
exports.setDevMode = (mode) => {
  devMode = mode;
}

exports.getConfig = (type) => {
  const config = configs[type][environment];
  return config;
}

exports.getEndpoint = () => {
  const endpoint = environment === 'dev' ? 'https://snapmaster-dev-7hjh6mhjjq-uc.a.run.app' 
                                         : 'https://snapmaster-iwswjzd7qa-uc.a.run.app';
  return endpoint;
}

exports.getUrl = () => {
  const endpoint = environment === 'dev' ? 'https://dev.snapmaster.io' 
                                         : 'https://www.snapmaster.io';
  return endpoint;
}

