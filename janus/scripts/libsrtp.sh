#!/bin/sh

wget https://github.com/cisco/libsrtp/archive/v2.4.2.tar.gz
tar xfv v2.4.2.tar.gz
cd libsrtp-2.4.2
./configure --prefix=/usr --enable-openssl
make shared_library && make install