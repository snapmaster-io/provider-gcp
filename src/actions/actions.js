// GCP provider actions

//const { mkdir, cd, rm, exec, echo, tempdir } = require('shelljs');
const workerpool = require('workerpool');
const { execFile } = require('child_process');


const execAsync = (cmd, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

const providerName = 'gcp';

const actions = {
  build: 'build',
  deploy: 'deploy'
}

const invokeAction = async (action, serviceCredentials, activeSnapId, param) => {
  try {

    // construct script name, environment, and full command
    const script = `./${action}.sh`;
    //const env = getEnvironment(param);
    const env = { ...process.env, ...getEnvironment(param), ACTIVESNAPID: activeSnapId, SERVICECREDS: serviceCredentials };
    //const command = getCommand(action, project, param);
    //const command = `ACTIVESNAPID=${activeSnapId} SERVICECREDS='${serviceCredentials}' ${env} ${cmd}`;

    // log a message before executing command
    console.log(`executing command: ${script}`);

    // setup environment
    //setupEnvironment(serviceCredentials, activeSnapId, project);

    // execute the action and obtain the output
    const output = await executeCommand(script, env);
    /*
    exec(command, function(code, stdout, stderr) {
      // setup environment
      teardownEnvironment(activeSnapId, project);

      // log a message after executing command
      console.log(`finished executing command: ${command}, return code ${code}`);
      
      // return to caller
      return { code, stdout, stderr };
    });

    return `gcp: executed ${command}`;*/
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

workerpool.worker({
  invokeAction: invokeAction
});


const executeCommand = async (command, env) => {
  try {
    // execute asynchronously so as to not block the web thread
    const returnVal = await execAsync(command, [], { env: env });
    return returnVal;
  } catch (error) {
    console.error(`executeCommand: caught exception: ${error}`);
    return error;
  }
}

/*
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
*/

const getEnvironment = (param) => {
  //let env = '';
  const env = {};
  for (const key in param) {
    //env += `${key.toUpperCase()}=${param[key]} `;
    const upperKey = key.toUpperCase();
    env[upperKey] = param[key];
  }
  return env;
}

/*

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
*/