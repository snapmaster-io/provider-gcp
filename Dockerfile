# grab the gcrane image
FROM gcr.io/go-containerregistry/gcrane:latest
# gcloud sdk + node image
FROM gcr.io/snapmaster-dev/gcloud-node-image:latest

# copy gcrane (utility to pull/push docker images without docker CLI, which requires 
# running privileged, something not yet possible with google cloud run)
COPY --from=0 /etc/ssl/certs /etc/ssl/certs
COPY --from=0 /ko-app/gcrane /usr/local/bin/gcrane

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
RUN npm install --only=production

# Copy local code to the container image.
COPY . ./

# set environment variable ENV to hosting type
ENV ENV=devhosted

# Run the web service on container startup.
CMD [ "node", "./index.js"]
