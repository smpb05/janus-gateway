FROM ubuntu:20.04
# install all dependencies
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
    libavutil-dev \
    libavcodec-dev \
    libavformat-dev \
    dos2unix \
    automake && \ 
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/janus-install

WORKDIR /usr/src/janus-install

COPY scripts /usr/src/janus-install/scripts
# must be ended with a new line "LF" (Unix) and not "CRLF" (Windows)
RUN dos2unix /usr/src/janus-install/scripts/libsrtp.sh
RUN dos2unix /usr/src/janus-install/scripts/janus.sh

RUN chmod a+rx /usr/src/janus-install/scripts/libsrtp.sh
RUN chmod a+rx /usr/src/janus-install/scripts/janus.sh