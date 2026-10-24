#!/bin/sh
set -eu

attempt=0
while [ ! -s "${CONTRACT_ADDRESS_FILE:-/runtime/contract-address}" ] && [ "$attempt" -lt 60 ]; do
  attempt=$((attempt + 1))
  sleep 1
done

if [ ! -s "${CONTRACT_ADDRESS_FILE:-/runtime/contract-address}" ]; then
  echo "The deployed contract address is not available." >&2
  exit 1
fi

CONTRACT_ADDRESS=$(tr -d '\r\n' <"${CONTRACT_ADDRESS_FILE:-/runtime/contract-address}")
export CONTRACT_ADDRESS

npm run dev:backend
