#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID

# set up authentication to gcr.io
gcrane auth login gcr.io -u _json_key -p "$SERVICECREDS"

# pull the image into a tar file
gcrane pull $SM_repo $SM_image.tar

# push the tar file into the gcr.io registry
gcrane push $SM_image.tar gcr.io/$SM_project/$SM_image

# remove the work directory
cd /
rm -fr /tmp/$ACTIVESNAPID
