// GCP provider service for action execution

const { checkJwt, logRequest } = require('./requesthandler');
const { execFile } = require('child_process');

const execAsync = (cmd, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      // resolve promise with an object containing all parameters
      resolve({ error, stdout, stderr });
    });
  });
}

exports.createHandlers = (app) => {
  // POST handler for invokeAction  
  app.post('/invokeAction', logRequest, checkJwt, function(req, res){
    const invoke = async (payload) => {
      const result = await invokeAction(payload);
      res.status(200).send(result);
    }

    invoke(req.body);
  });
}

const invokeAction = async (request) => {
  try {
    const activeSnapId = request.activeSnapId;
    const connectionInfo = request.connectionInfo;
    const param = request.param;
    if (!activeSnapId || !connectionInfo || !param) {
      console.error('invokeAction: missing one of activeSnapId, connectionInfo, or param in request');
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

    // IMPLEMENTATION NOTE:
    //   current implementation shell-execs scripts containing gcloud SDK commands, because 
    //   the REST API for google cloud build and google cloud run is pretty gnarly, and the  
    //   node.js packages are either difficult to use or nonexistent.

    // obtain the service creds from the connectionInfo
    const serviceCredentials = await getServiceCredentials(connectionInfo);
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

    console.log(`gcp: finished executing action ${action}, stdout: ${output && output.stdout}, stderr: ${output && output.stderr}`);

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

// get the service credentials from the keyfile content stored in the connection info
const getServiceCredentials = async (connectionInfo) => {
  try {
    const key = connectionInfo && connectionInfo.find(c => c.name === 'key');
    if (!key) {
      console.error('getServiceCredentials: could not find key in connection info');
      return null;
    }

    return key.value;
  } catch (error) {
    console.error(`getServiceCredentials: caught exception: ${error}`);
    return null;
  }
}
