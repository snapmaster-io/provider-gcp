const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// get environment (dev or prod) based on environment variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);
const configuration = env === 'devhosted' ? 'prod' : env;
console.log('configuration:', configuration);
const account = env === 'devhosted' ? 'dev' : env;
console.log('account:', account);

// set the environment in the environment service
const environment = require('./src/environment');
environment.setEnv(account);
environment.setDevMode(configuration === environment.dev);

// create a new express app
const app = express();

// Enable CORS
app.use(cors());

// Enable the use of request body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({
  extended: true
}));

// create route handlers for the provider
const provider = require('./src/provider');
provider.createHandlers(app);

// Launch the API Server at PORT, or default port 8080
const port = process.env.PORT || (configuration === 'prod' ? 8080 : 8081);
app.listen(port, () => {
  console.log('SnapMaster GCP provider listening on port', port);
});
