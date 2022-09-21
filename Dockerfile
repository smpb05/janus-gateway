FROM ubuntu:20.04

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y update && \
	apt-get install -yq \
    build-essential \
    git \ 
    wget \ 
    meson \
    libjansson-dev \
    libconfig-dev 

RUN mkdir -p /usr/src/janus-install

WORKDIR /usr/src/janus-install

COPY . /usr/src/janus-install/

# RUN /usr/src/janus-install/scripts/libnice.sh
# RUN /usr/src/janus-install/scripts/libsrtp.sh