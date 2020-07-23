// trigger.js implements the provider-specific creation, deletion, and handling of triggers
//
// exports:
//   createTrigger: create the trigger
//   deleteTrigger: delete the trigger
//   handleTrigger: handle trigger invocation

const auth0 = require('./auth0');
const environment = require('./environment');
const pubsub = require('./pubsub');
const { successvalue, errorvalue } = require('./returnvalue');

const axios = require('axios');

// define provider-specific constants
const providerName = 'gcp';
const entityName = `${providerName}:projects`;
const defaultEntityName = `${entityName}:default`;

exports.createTrigger = async (request) => {
  try {
    const userId = request.userId;
    const activeSnapId = request.activeSnapId;
    const connectionInfo = request.connectionInfo;
    const param = request.param;
    if (!userId || !activeSnapId || !param) {
      const message = 'missing one of userId, activeSnapId, or param in request body';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // get required parameters
    const event = param.event;
    if (!event) {
      const message = 'missing required parameter "event"';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    if (event !== 'pubsub') {
      const message = `unknown event "${event}"`;
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    const topicName = param.topic;
    if (!topicName) {
      const message = 'missing required parameter "topic"';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    const project = param.project;
    if (!project) {
      const message = 'missing required parameter "project"';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // get the correct credentials for the project (either passed explicitly, or the default)
    const projectInfo = (project === defaultEntityName) ? 
      connectionInfo :
      param[entityName];
    if (!projectInfo) {
      const message = `missing required parameter ${entityName}`;
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // obtain the service creds from the gcpProject
    const serviceCredentials = await getServiceCredentials(projectInfo);
    if (!serviceCredentials) {
      const message = 'service credentials not found';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // create or get a reference to the topic
    const topic = await pubsub.createTopic(serviceCredentials, topicName);
    if (!topic) {
      const message = `could not create or find topic ${topicName}`;
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // set up a push subscription for the production environment
    const subName = `snapmaster-${activeSnapId}-${topicName}`;
    const providerUrl = environment.getProviderUrl(providerName);
    const endpoint = encodeURI(`${providerUrl}/${providerName}/webhooks/${userId}/${activeSnapId}`);
    const sub = await pubsub.createPushSubscription(serviceCredentials, topic, subName, endpoint, serviceCredentials.client_email);
    if (!sub) {
      const message = `could not create subscription for topic ${topicName}`;
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }

    // return just the trigger URL 
    return successvalue({ url: endpoint, id: subName });
  } catch (error) {
    console.error(`createTrigger: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

exports.deleteTrigger = async (request) => {
  try {
    const connectionInfo = request.connectionInfo;
    const param = request.param;
    if (!param) {
      const message = 'missing required field "param" in request body';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    // get required parameters
    const event = param.event;
    if (!event) {
      const message = 'missing required parameter "event"';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    if (event !== 'pubsub') {
      const message = `unknown event "${event}"`;
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    const topicName = param.topic;
    if (!topicName) {
      const message = 'missing required parameter "topic"';
      console.error(`createTrigger: ${message}`);
      return errorvalue(message);
    }
    
    const project = param.project;
    if (!project) {
      const message = 'missing required parameter "project"';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    // get the correct credentials for the project (either passed explicitly, or the default)
    const projectInfo = (project === defaultEntityName) ? 
      connectionInfo :
      param[entityName];
    if (!projectInfo) {
      const message = `missing required parameter ${entityName}`;
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    // obtain the service creds from the gcpProject
    const serviceCredentials = await getServiceCredentials(projectInfo);
    if (!serviceCredentials) {
      const message = 'service credentials not found';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }
    
    // get trigger data
    const triggerData = request.triggerData;
    if (!triggerData) {
      const message = 'missing triggerData in request';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }
    
    // extract subscription name
    const subName = triggerData.id;
    if (!subName) {
      const message = 'triggerData missing required parameter "id"';
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    // delete the subscription
    const response = await pubsub.deleteSubscription(serviceCredentials, subName);
    if (response === null) {
      const message = `could not delete subscription to topic ${topicName}`;
      console.error(`deleteTrigger: ${message}`);
      return errorvalue(message);
    }

    // return a success code
    return successvalue(response);
  } catch (error) {
    console.error(`deleteTrigger: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

exports.handleTrigger = async (userId, activeSnapId, event, payload) => {
  try {
    if (event !== 'pubsub') {
      console.error(`handleTrigger: unknown event ${event}`);
      return null;
    }
        
    // invoke the snap engine
    const response = await callSnapEngine(userId, activeSnapId, event, payload);
    return response;
  } catch (error) {
    console.error(`handleTrigger: caught exception: ${error}`);
    return null;
  }
}

const callSnapEngine = async (userId, activeSnapId, event, payload) => {
  try {
    // get an access token for the provider service
    // currently  provider services all do auth via Auth0, and all share an Auth0 API service clientID / secret
    const token = await auth0.getAPIAccessToken();
    if (!token) {
      console.error('createTrigger: could not retrieve API access token');
      return null;
    }

    // construct snap engine dispatch URL
    const snapEngineUrl = `${environment.getUrl()}/executesnap/${userId}/${activeSnapId}`;
    const body = {
      event: event,
      ...payload
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const response = await axios.post(
      snapEngineUrl,
      body,
      {
        headers: headers
      });

    const message = `${providerName}: invoked snap engine at ${snapEngineUrl}`;
    console.log(message);
    return { status: 'success', message: message };
  } catch (error) {
    console.error(`callSnapEngine: caught exception: ${error}`);
    return null;
  }    
}

// get the service credentials from the keyfile content stored in the GCP project info
const getServiceCredentials = async (gcpProject) => {
  try {
    const key = gcpProject.key;
    if (!key) {
      console.error('getServiceCredentials: could not find key in gcp:projects');
      return null;
    }

    const keyInfo = JSON.parse(key);  
    if (!keyInfo || !keyInfo.private_key || !keyInfo.client_email) {
      console.error('getServiceCredentials: could not parse GCP key information');
      return null;
    }

    return keyInfo;
  } catch (error) {
    console.error(`getServiceCredentials: caught exception: ${error}`);
    return null;
  }
}
