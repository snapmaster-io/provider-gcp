#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID
echo $SERVICECREDS >creds.json

# set up gcloud authentication
gcloud auth activate-service-account snapmaster@$SM_project.iam.gserviceaccount.com --key-file=creds.json --project=$SM_project

# copy the image
gcrane cp $SM_repo gcr.io/$SM_project/$SM_image

# revoke the credentials
gcloud auth revoke snapmaster@$SM_project.iam.gserviceaccount.com

# remove the work directory
cd /
rm -fr /tmp/$ACTIVESNAPID
