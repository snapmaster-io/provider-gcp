// GCP provider

const { mkdir, cd, rm, echo, exec, tempdir } = require('shelljs');
const { checkJwt, logRequest } = require('./requesthandler');
const { execFile } = require('child_process');
const workerpool = require('workerpool');

// create a worker pool using an external worker script
const pool = workerpool.pool(__dirname + '/actions/actions.js');

const execAsync = (cmd, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

const actions = {
  build: 'build',
  deploy: 'deploy'
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
    //   current implementation shell-execs gcloud SDK commands, because the REST API for 
    //   google cloud build and google cloud run is pretty gnarly, and the node.js packages 
    //   are either difficult to use or nonexistent.

    // set up the environment
    const serviceCredentials = await getServiceCredentials(connectionInfo);
    if (!serviceCredentials) {
      console.error(`invokeAction: service credentials not found`);
      return null;
    }

    console.log(`gcp: executing action ${action} in project ${project}`);

    // construct script name, environment, and full command
    const env = getEnvironment(param);
    const cmd = getCommand(action, project, param);
    const command = `ACTIVESNAPID=${activeSnapId} SERVICECREDS='${serviceCredentials}' ${env} ${cmd}`;
    
    // run registered functions on the worker via exec
    //const output = await pool.exec('invokeAction', [action, serviceCredentials, activeSnapId, param]);

    // setup environment
    setupEnvironment(serviceCredentials, activeSnapId, project);

    // execute command synchronously
    const output = exec(command);

    // teardown environment
    teardownEnvironment(activeSnapId, project);

    console.log(`gcp: finished executing action ${action} with output ${output}`);

    // return output
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

const getCommand = (action, project, param) => {
  try {
    const image = param.image;
    if (!image) {
      console.error(`getCommand: action ${action} requires image name`);
      return null;
    }

    // set up the base command with the account and project information
    const baseCommand = `gcloud --account snapmaster@${project}.iam.gserviceaccount.com --project ${project} `;

    // return the right shell command to exec for the appropriate action
    switch (action) {
      case actions.build:
        return `${baseCommand} builds submit --tag gcr.io/${project}/${image}`;
      case actions.deploy: 
        const service = param.service;
        if (!service) {
          console.error(`getCommand: action ${action} requires service name`);
          return null;
        }
        const region = param.region;
        if (!region) {
          console.error(`getCommand: action ${action} requires region name`);
          return null;
        }
        return `${baseCommand} run deploy ${service} --image gcr.io/${project}/${image} --platform managed --allow-unauthenticated --region ${region}`;
      default:
        console.error(`getCommand: unknown command ${action}`);
        return null;
    }
  } catch (error) {
    console.error(`getCommand: caught exception: ${error}`);
    return null;
  }
}

const getEnvironment = (param) => {
  let env = '';
  //const env = {};
  for (const key in param) {
    env += `${key.toUpperCase()}=${param[key]} `;
    //const upperKey = key.toUpperCase();
    //env[upperKey] = param[key];
  }
  return env;
}

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

const setupEnvironment = (serviceCredentials, activeSnapId, project) => {
  try {
    // create temporary directory
    const tmp = tempdir();
    const dirName = `${tmp}/${activeSnapId}`;
    mkdir(dirName);
    cd(dirName);

    // create creds.json file
    // BUGBUG: make sure this doesn't log to the console
    echo(serviceCredentials).to('creds.json');

    // execute the gcloud auth call
    const output = exec(`gcloud auth activate-service-account snapmaster@${project}.iam.gserviceaccount.com --key-file=creds.json --project=${project}`);  
    return output;
  } catch (error) {
    console.error(`setupEnvironment: caught exception: ${error}`);
    return null;
  }
}

const teardownEnvironment = (activeSnapId, project) => {
  try {
    // remove the cached gcloud credential
    const output = exec(`gcloud auth revoke snapmaster@${project}.iam.gserviceaccount.com`);  

    // remove temporary directory and everything in it
    const tmp = tempdir();
    const dirName = `${tmp}/${activeSnapId}`;
    rm('-rf', dirName);

    return output;
  } catch (error) {
    console.error(`teardownEnvironment: caught exception: ${error}`);
    return null;
  }
} 
