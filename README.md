# Janus Media Gateway

## How to run
- install docker app https://www.docker.com/
- build image ```docker build --tag janus-gateway . ```
- change settings if needed in janus.jcfg
- edit docker-compose.yaml if needed
    - set mapped port and volumes
- run ```docker-compose up``` use flag ```--force-recreate``` to update settings

### important
use "host" network_mode for production - docker has problems with large port range
https://github.com/instrumentisto/coturn-docker-image/issues/3