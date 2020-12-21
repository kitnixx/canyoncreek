#FROM r-base
#RUN apt-get update -y
#RUN apt-get install git -y
#RUN apt-get install nodejs -y
#RUN apt-get install npm -y
#RUN apt-get install libcurl4-openssl-dev libssl-dev unixodbc unixodbc-dev libtiff-dev fftw-dev fftw3 fftw3-dev libv8-dev perl -y
#RUN apt-get install libgdal-dev libgeos++-dev libudunits2-dev libproj-dev libx11-dev libgl1-mesa-dev libglu1-mesa-dev libfreetype6-dev libv8-dev libxt-dev -y
#WORKDIR /usr/src/app
#COPY ec2_batch/install.R .
#RUN Rscript ./install.R
#RUN rm ./install.R

# FROM gearsmotion789/rbase
# WORKDIR /usr/src/app
# COPY ec2_batch/install.R .
# RUN Rscript ./install.R
# RUN rm ./install.R

FROM gearsmotion789/rbase
WORKDIR /usr/src/app
COPY package.json .
RUN npm install --production --silent
COPY . .
WORKDIR /usr/src/app/backend
CMD [ "node", "index.js" ]
EXPOSE 80
