# CanyonCreekLidar

### Job Operations
- Send job
```
POST <ec2 dns>/start
{
  "bucket": "canyon-creek-lidar-0",
  "data": "test-small-file",
  "algorithm": "dalponte2016",
  "ws": 10
}
--- other parameters may be passed too ---
```
- Get job status
```
GET <ec2 dns>/status/<job id>
```
- Cancel job
```
DELETE <ec2 dns>/cancel/<job id>
```

### Typical Docker Commands
```
# SSH into EC2 instance
ssh -i "key.pem" ec2-user@<ec2 dns>

# Pull image
docker pull gearsmotion789/canyoncreeklidar

# Run container with Cloudwatch Logging
docker run -p 80:80 -d --name canyoncreeklidar --restart unless-stopped --log-driver=awslogs --log-opt awslogs-group=CanyonCreekLidar gearsmotion789/canyoncreeklidar

# Open container terminal
docker exec -it canyoncreeklidar bash

# Stop container
docker rm -f canyoncreeklidar
```

### Extras
```
# Download folder from S3 to local
aws s3 sync "s3://canyon-creek-bucket-0/<folder>/<job id>" "./<job id>"
aws s3 sync "s3://canyon-creek-bucket-0/test-small-file/asdf" "./asdf"

# Get log outputs from running docker container
docker logs canyoncreeklidar
```

### Setup for running locally
- Install node.js: https://nodejs.org/en/download
- Install git: https://git-scm.com/downloads
- Install R: https://ftp.osuosl.org/pub/cran
- Add R to environmental variabale PATH
  - ```C:/Program Files/R/<version>/bin```
- Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-windows.html#cliv2-windows-install
  - ```aws configure```
  - Fill credentials with AWS user credentials in IAM users
- ```git clone https://github.com/gearsmotion789/CanyonCreekLidar.git```
- ```npm install``` in CanyonCreekLidar (root) directory
- Install all dependencies via R from ```ec2_batch/install.R```
- ```cd backend```
  - must be in backend directory, otherwise things don't work
- ```node test.js``` for quick test
- ```node index.js``` for backend REST API server

### Information
- backend (runs on EC2 instance)
  - hosts backend so that you can make REST API calls to it for job operations
  - when POST occurs, it triggers s3_download, ec2_batch, and then s3_upload internal to ec2_batch, then uploads job params via s2_upload
- s3_download (runs on EC2 instance)
  - downloads data from S3 to local machine
- ec2_batch (runs on EC2 instance)
  - generates the outputs from the Rscript
- s3_upload (runs on EC2 instance)
  - uploads outputs to S3 folder
- pc_to_s3 (runs on your own local machine)
  - modified version of "s3_upload", uploads all folders from local machine to S3

### Normal GitHub setup
- Link existing folder with this repo
  - git init
  - git remote add origin https://github.com/gearsmotion789/CanyonCreekLidar.git
  - git fetch
  - git checkout master
  - git pull
  - git add .
  - git commit -m "comment"
  - git push
- Pull changes
  - git fetch
  - git pull
- Push changes
  - first do Pull changes
  - git add .
  - git commit -m "comment"
  - git push

### References
- Setup Docker on EC2 Instance
  - https://hackernoon.com/running-docker-on-aws-ec2-83a14b780c56
- Cloudwatch Logging
  - https://cloudonaut.io/a-simple-way-to-manage-log-messages-from-containers-cloudwatch-logs/#:~:text=Simple%20Example,and%20attach%20the%20CloudWatchLogsFullAccess%20policy
