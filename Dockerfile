FROM ubuntu:20.04

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y update && \
	apt-get install -yq \
    build-essential \
    git \ 
    wget \ 
    meson \
    libjansson-dev \
    libconfig-dev \
    libnice-dev \
    libssl-dev \
    libsrtp2-dev \
    libusrsctp-dev \
    libmicrohttpd-dev \
    libwebsockets-dev \
    libopus-dev \
    libogg-dev \
    libcurl4-openssl-dev \
    libglib2.0-dev \
    pkg-config \
    zlib1g-dev \
    libtool \
    automake 

RUN mkdir -p /usr/src/janus-install

WORKDIR /usr/src/janus-install

COPY . /usr/src/janus-install/

RUN /usr/src/janus-install/scripts/janus.sh

EXPOSE 20000-40000/udp
EXPOSE 8188
EXPOSE 8088
EXPOSE 8089
EXPOSE 8889
EXPOSE 8000
EXPOSE 7088
EXPOSE 7089