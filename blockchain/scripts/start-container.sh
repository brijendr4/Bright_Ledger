#!/bin/sh
set -eu

npm run chain:node &
chain_pid=$!
trap 'kill "$chain_pid" 2>/dev/null || true; wait "$chain_pid" 2>/dev/null || true' INT TERM EXIT

ready=false
attempt=0
while [ "$attempt" -lt 60 ]; do
  if node --input-type=module -e "const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_chainId',params:[],id:1})});const j=await r.json();if(j.result==='0x7a69')process.exit(0);process.exit(1)" >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$ready" != true ]; then
  echo "Local Hardhat RPC did not become ready at http://127.0.0.1:8545." >&2
  exit 1
fi

deployment_log=/tmp/bright-ledger-contract-deployment.log
if ! npm run chain:deploy >"$deployment_log" 2>&1; then
  cat "$deployment_log" >&2
  exit 1
fi
cat "$deployment_log"

contract_address=$(sed -n 's/^EnergyTrading deployed to //p' "$deployment_log" | tail -n 1)
case "$contract_address" in
  0x????????????????????????????????????????) ;;
  *)
    echo "Could not read the deployed contract address from Hardhat output." >&2
    exit 1
    ;;
esac

printf '%s\n' "$contract_address" >"${CONTRACT_ADDRESS_FILE}.tmp"
mv "${CONTRACT_ADDRESS_FILE}.tmp" "$CONTRACT_ADDRESS_FILE"
echo "Local chain and EnergyTrading contract are ready at $contract_address."

wait "$chain_pid"
