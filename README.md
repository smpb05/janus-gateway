# Janus Media Gateway

## How to run
- install docker app https://www.docker.com/

### Janus Gateway
- build image ```docker build --tag janus-gateway . ```
- change settings if needed in janus.jcfg
- edit docker-compose.yaml if needed
    - set mapped port and volumes

### Video-Converter
- build image ```docker build --tag video-converter . ```
- change settings if needed:
    - config.js - main app settings
    - /shell-scripts/* - video folders path settings
    - /public/js/player.js - video player settings
    - redis.conf - Redis settings 
- edit docker-compose.yaml if needed
    - set mapped port and volumes

- run ```docker-compose up``` use flag ```--force-recreate``` to update settings on restart

### important
use "host" network_mode for production - docker has problems with large port range
https://github.com/instrumentisto/coturn-docker-image/issues/3

### docker-compose
- ```docker-compose build``` to build all images
- ```docker-compose up``` to run all containers