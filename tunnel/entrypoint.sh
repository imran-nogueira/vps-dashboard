#!/bin/sh
set -e

# The private key arrives read-only from the host bind mount; ssh refuses
# keys that aren't 0600, so copy it into the container's own writable tmpfs
# first.
cp /run/secrets/tunnel_key_ro /tmp/tunnel_key
chmod 600 /tmp/tunnel_key

: "${TUNNEL_HOST:?TUNNEL_HOST is required}"
: "${TUNNEL_USER:=tunnel}"
: "${TUNNEL_REMOTE_PORT:=9090}"
: "${TUNNEL_LOCAL_PORT:=9090}"

export AUTOSSH_GATETIME=0

exec autossh -M 0 -N \
  -o StrictHostKeyChecking=accept-new \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -i /tmp/tunnel_key \
  -L "0.0.0.0:${TUNNEL_LOCAL_PORT}:localhost:${TUNNEL_REMOTE_PORT}" \
  "${TUNNEL_USER}@${TUNNEL_HOST}"
