// GCP provider service for action execution

const { checkJwt, logRequest } = require('./requesthandler');
const { execFile } = require('child_process');
const trigger = require('./trigger.js');

// define provider-specific constants
const providerName = 'gcp';
const entityName = `${providerName}:projects`;
const defaultEntityName = `${entityName}:default`;

const execAsync = (cmd, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      // resolve promise with an object containing all parameters
      resolve({ error, stdout, stderr });
    });
  });
}

exports.createHandlers = (app) => {
  app.post('/createTrigger', logRequest, checkJwt, function(req, res){
    (async () => res.status(200).send(await trigger.createTrigger(req.body)))();
  });

  app.post('/deleteTrigger', logRequest, checkJwt, function(req, res){
    (async () => res.status(200).send(await trigger.deleteTrigger(req.body)))();
  });

  // POST webhooks endpoint
  app.post(`/${providerName}/webhooks/:userId/:activeSnapId`, function(req, res){
    try {
      const userId = decodeURI(req.params.userId);
      const activeSnapId = req.params.activeSnapId;
      console.log(`POST /${providerName}/webhooks: userId ${userId}, activeSnapId ${activeSnapId}`);

      /*
      // validate JWT
      const auth = req.headers.authorization;
      const [, token] = auth.match(/Bearer (.*)/);
    
      // validate the authorization bearer JWT
      if (!google.validateJwt(token)) {    
        res.status(401).send();
      }
      */

      // handle the webhook
      const handle = async (payload) => {
        const response = await trigger.handleTrigger(userId, activeSnapId, 'pubsub', payload) || 
          { status: 'error', message: `${providerName}: could not trigger active snap ${userId}:${activeSnapId} `};

        res.status(200).send(response);
      }

      handle(req.body);
    } catch (error) {
      console.error(`${providerName} webhook caught exception: ${error}`);
      res.status(500).send(error);
    }
  });

  // POST handler for invokeAction  
  app.post('/invokeAction', logRequest, checkJwt, function(req, res){
    (async () => res.status(200).send(await invokeAction(req.body)))();
  });
}

const invokeAction = async (request) => {
  try {
    const activeSnapId = request.activeSnapId;
    const param = request.param;
    if (!activeSnapId || !param) {
      console.error('invokeAction: missing one of activeSnapId or param in request');
      return null;
    }

    // get required parameters
    const action = param.action;
    if (!action) {
      console.error('invokeAction: missing required parameter "action"');
      return null;
    }

    const project = param.project;
    if (!project) {
      console.error('invokeAction: missing required parameter "project"');
      return null;
    }

    // get the correct credentials for the project (either passed explicitly, or the default)
    const projectInfo = (project === defaultEntityName) ? 
      connectionInfo :
      param[entityName];
    if (!projectInfo) {
      console.error(`invokeAction: missing required parameter ${entityName}`);
      return null;
    }

    // IMPLEMENTATION NOTE:
    //   current implementation shell-execs scripts containing gcloud SDK commands, because 
    //   the REST API for google cloud build and google cloud run is pretty gnarly, and the  
    //   node.js packages are either difficult to use or nonexistent.

    // obtain the service creds from the gcpProject
    const serviceCredentials = await getServiceCredentials(projectInfo);
    if (!serviceCredentials) {
      console.error(`invokeAction: service credentials not found`);
      return null;
    }

    console.log(`gcp: executing action ${action} in project ${project}`);

    // construct script name and environment
    const script = `./src/actions/${action}.sh`;
    const env = { ...process.env, ...getEnvironment(param), ACTIVESNAPID: activeSnapId, SERVICECREDS: serviceCredentials };

    // execute the command and await its output
    const output = await executeCommand(script, env);

    // construct output string message
    const outputString = 
      `${output && output.error && output.error.message ? `error: ${output.error.message}, ` : ''}` + 
      `stdout: ${output && output.stdout}, stderr: ${output && output.stderr}`;

    console.log(`gcp: finished executing action ${action}; output: ${outputString}`);

    // return output
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

const executeCommand = async (command, env) => {
  try {
    const returnVal = await execAsync(command, [], { env: env });
    return returnVal;
  } catch (error) {
    console.error(`executeCommand: caught exception: ${error}`);
    return error;
  }
}

// create an environemnt object from the param with keys starting with 'SM_'
const getEnvironment = (param) => {
  const env = {};
  for (const key in param) {
    const prefixedKey = `SM_${key}`;
    env[prefixedKey] = param[key];
  }
  return env;
}

// get the service credentials from the keyfile content stored in the GCP project info
const getServiceCredentials = async (gcpProject) => {
  try {
    const key = gcpProject.key;
    if (!key) {
      console.error('getServiceCredentials: could not find key in gcp:projects');
      return null;
    }

    return key;
  } catch (error) {
    console.error(`getServiceCredentials: caught exception: ${error}`);
    return null;
  }
}
