FROM ubuntu:20.04
RUN apt-get update && apt-get install -yq xz-utils curl cron dos2unix 
# remove for production 
# RUN apt-get install -yq systemctl nano
WORKDIR /usr/src/app
COPY . .
# replace source.list for the correct installation janus-tools
RUN mv /etc/apt/sources.list /etc/apt/sources.list.backup
RUN cp /usr/src/app/sources.list /etc/apt/sources.list
RUN apt-get update && apt-get install -y janus-tools
# installing ffmpeg according to instructions https://www.johnvansickle.com/ffmpeg/faq/
WORKDIR "./libs"
RUN tar -xvf ffmpeg-git-amd64-static.tar.xz
RUN mv ffmpeg-git-20220910-amd64-static/ffmpeg ffmpeg-git-20220910-amd64-static/ffprobe /usr/local/bin/
# adding cron task
# must be ended with a new line "LF" (Unix) and not "CRLF" (Windows)
RUN dos2unix /usr/src/app/shell-scripts/convert-mjr.sh
RUN chmod 755 /usr/src/app/shell-scripts/convert-mjr.sh

RUN dos2unix /usr/src/app/shell-scripts/organize-mjr.sh
RUN chmod 755 /usr/src/app/shell-scripts/organize-mjr.sh

RUN dos2unix /usr/src/app/shell-scripts/video-process.sh
RUN chmod 755 /usr/src/app/shell-scripts/video-process.sh

RUN crontab -l | { cat; echo "*/1 * * * * /usr/src/app/shell-scripts/video-process.sh"; } | crontab -
# CMD cron
# installing nodejs 14.x
RUN curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install nodejs
# install video-converter dependencies
WORKDIR /usr/src/app
RUN npm install