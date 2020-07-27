// pubsub system based on google cloud pubsub
// exports:
//   createTopic: creates a topic, or if it exists, gets a reference to it
//   createSubscription: creates a sub on a topic, using the event handlers passed in

const { PubSub } = require('@google-cloud/pubsub');

// set up some constants
const ackDeadlineSeconds = 60;  // allow 60 seconds for message processing
const maxMessages = 1;  // only process one message at a time

exports.createTopic = async (keyInfo, topicName) => {
  let pubsub;

  try {
    // get an initialized client
    pubsub = getPubSub(keyInfo);
    if (!pubsub) {
      return null;
    }

    // create the topic
    const [topic] = await pubsub.createTopic(topicName);
    return topic;
  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      // return the topic
      return await pubsub.topic(topicName);
    }
    console.log(`createTopic caught exception: ${error}`);
  }
}

exports.createPushSubscription = async (keyInfo, topic, subName, endpoint, serviceAccount) => {
  // create or retrieve the subscription
  const subscription = await createSubscription(keyInfo, topic, subName, endpoint, serviceAccount);
  console.log(`listening on subscription ${subName} on endpoint ${endpoint}`);

  return subscription;
}

// create a pull subscription on the subscription topic name, with a message handler 
exports.createPullSubscription = async (keyInfo, topic, subName, handler) => {

  // define the message handler
  const messageHandler = async (message) => {
    try {
      console.log(`Received message ${message.id}:`);
      console.log(`\tData: ${message.data}`);
  
      handler && await handler(message.data);
    } catch (error) {
      console.log(`messageHandler: caught exception ${error}`);
    }
  
    // always ack the message
    message.ack();
  };

  // define the error handler
  const errorHandler = async (error) => {
    console.log(`errorHandler: caught error ${error}:`);
  }
  
  try {
    // create or retrieve the subscription (null endpoint indicates a pull sub)
    const subscription = await createSubscription(keyInfo, topic, subName, null);

    // listen for new messages
    subscription.on(`message`, messageHandler);
    subscription.on(`error`, errorHandler);
    console.log(`listening on subscription ${subName}`);
  } catch (error) {
    console.log(`createPullSubscription: caught exception ${error}`);
  }
}

exports.deleteSubscription = async (keyInfo, subName) => {
  try {
    // get an initialized client
    const pubsub = getPubSub(keyInfo);
    if (!pubsub) {
      return null;
    }

    // delete the subscription
    const response = await pubsub.subscription(subName).delete();
    return response && response.length && response[0];
  } catch (error) {
    console.error(`deleteSubscription: caught exception: ${error}`);
    return null;
  }
}

// create or retrieve the subscription
// a non-null endpoint indicates a push subscription
const createSubscription = async (keyInfo, topic, subName, endpoint, serviceAccount) => {
  const baseOptions = { 
    ackDeadlineSeconds: ackDeadlineSeconds,
    flowControl: {
      maxMessages: maxMessages,
    }
  }
  const pushOptions = {
    pushConfig: {
      pushEndpoint: endpoint,
      oidcToken: {
        serviceAccountEmail: serviceAccount
      }
    }
  }
  const options = endpoint ? { ...baseOptions, ...pushOptions } : baseOptions;

  let pubsub;

  try {
    // get an initialized client
    pubsub = getPubSub(keyInfo);
    if (!pubsub) {
      return null;
    }

    // try to create a new subscription
    const [subscription] = await pubsub.createSubscription(topic, subName, options);
    return subscription;
  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      try {
        // use the existing subscription
        const subscription = await pubsub.subscription(subName, options);
        return subscription;
      } catch (subError) {
        console.log(`createSubscription caught exception when trying to obtain existing subscription: ${subError}`);
        return null;
      }
    } else {
      // this is an unknown error
      console.log(`createSubscription caught exception: ${error}`);
      return null;
    }
  }
}

const getPubSub = (keyInfo) => {
  const pubsub = new PubSub({
    projectId: keyInfo.project_id,
    credentials: { 
      client_email: keyInfo.client_email,
      private_key: keyInfo.private_key,
    }
  });
  return pubsub;
}