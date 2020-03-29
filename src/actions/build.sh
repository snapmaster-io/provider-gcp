#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID
echo $SERVICECREDS >creds.json

# set up gcloud authentication
gcloud auth activate-service-account snapmaster@$SM_project.iam.gserviceaccount.com --key-file=creds.json --project=$SM_project

# clone the repo
git clone $SM_repo
cd `basename $SM_repo`

# build the image from the current directory using the credentials set up above
gcloud --account snapmaster@$SM_project.iam.gserviceaccount.com --project $SM_project builds submit --tag gcr.io/$SM_project/$SM_image

# revoke the credentials
gcloud auth revoke snapmaster@$SM_project.iam.gserviceaccount.com

# remove the work directory
cd /
rm -fr /tmp/$ACTIVESNAPID
