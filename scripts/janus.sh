#!/bin/sh

git clone https://github.com/meetecho/janus-gateway.git
cd janus-gateway

sh autogen.sh
./configure --prefix=/opt/janus --enable-websockets
make
make install
make configs