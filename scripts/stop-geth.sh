#!/usr/bin/env bash
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
process-pid(){
  lsof -t -i:$1
}

stop-chain(){
  read NETWORK_REF PORT CHAIN_ID < <($DIR/get-network-config $1)
  CHAIN_PID=$(process-pid $PORT)
  if [[ $CHAIN_PID ]]; then
    kill -9 $CHAIN_PID
    echo "Shutdown blockchain($NETWORK_REF) on $PORT"
  fi
}

stop-chain $1
