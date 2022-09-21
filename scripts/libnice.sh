#!/bin/sh

export GIT_SSL_NO_VERIFY=1
# uncomment line above if got error "server certificate verification failed"
git clone https://gitlab.freedesktop.org/libnice/libnice
cd libnice
meson --prefix=/usr build && ninja -C build && ninja -C build install