#!/usr/bin/env bash
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
GAS_PRICE=1000000000
BLOCK_GAS_LIMIT=7989556
CONFIG_DIR=$DIR/testnet
LOG_DIR=$DIR/../logs

process-pid(){
  lsof -t -i:$1
}

frg-geth(){
  geth --maxpeers 0 \
   --nodiscover \
   --http \
   --http.corsdomain "*" \
   --http.api="eth,net,web3,personal,admin" \
   --ws \
   --ws.origins "*" \
   --ws.api="eth,net,web3,personal,admin" \
   --rpc.allow-unprotected-txs \
   --nat "any"  \
   --verbosity 3 \
   --miner.etherbase "3b2b9efdae5291f3bb9c7e6508c7e67534511585" \
   --miner.gasprice $GAS_PRICE \
   --ipcdisable \
   "$@"
}

run-geth(){
  REFRESH=$1
  NETWORK_REF=$2
  PORT=$3
  CHAIN_ID=$4
  echo "Running local geth network: $NETWORK_REF"

  CHAIN_DATA=$LOG_DIR/chain_data_$NETWORK_REF
  if [ $REFRESH == 1 ]; then
    rm -rf $CHAIN_DATA
    echo "Cleaning up: $CHAIN_DATA"
  fi
  echo "Saving blockchain data at: $CHAIN_DATA"

  GENESIS_CONFIG=$CONFIG_DIR/$NETWORK_REF.json
  frg-geth --datadir $CHAIN_DATA \
    --identity $NETWORK_REF \
    init $GENESIS_CONFIG
  echo "Initialized local geth chain using: $GENESIS_CONFIG"

  echo "Setting up wallets and private keys for testing"
  echo "Using keys from: $CONFIG_DIR"
  frg-geth account import --datadir $CHAIN_DATA --password $CONFIG_DIR/frg-local-password $CONFIG_DIR/frg-local-key1
  frg-geth account import --datadir $CHAIN_DATA --password $CONFIG_DIR/frg-local-password $CONFIG_DIR/frg-local-key2
  frg-geth account import --datadir $CHAIN_DATA --password $CONFIG_DIR/frg-local-password $CONFIG_DIR/frg-local-key3
  frg-geth account import --datadir $CHAIN_DATA --password $CONFIG_DIR/frg-local-password $CONFIG_DIR/frg-local-key4
  frg-geth account import --datadir $CHAIN_DATA --password $CONFIG_DIR/frg-local-password $CONFIG_DIR/frg-local-key5
  WALLETS="$(cat $CONFIG_DIR/frg-local-wallet1),$(cat $CONFIG_DIR/frg-local-wallet2)"
  WALLETS="$WALLETS,$(cat $CONFIG_DIR/frg-local-wallet3),$(cat $CONFIG_DIR/frg-local-wallet4)"
  WALLETS="$WALLETS,$(cat $CONFIG_DIR/frg-local-wallet5)"

  frg-geth --datadir $CHAIN_DATA \
     --unlock "$WALLETS" --password $CONFIG_DIR/frg-local-password \
     --allow-insecure-unlock \
     --identity $NETWORK_REF \
     --networkid $CHAIN_ID \
     --http.port $((PORT)) \
     --ws.port $((PORT+1)) \
     --port $((PORT+2)) \
     --mine \
     --verbosity 3 &> $LOG_DIR/$NETWORK_REF.log &

  echo "Started local geth chain"
  echo "RPC HTTP port: $((PORT))"
  echo "RPC WS port: $((PORT+1))"
  echo "RPC port: $((PORT+2))"
  echo "Logging: $LOG_DIR/$NETWORK_REF.log"
}

start-geth(){
  REFRESH=1
  read NETWORK_REF PORT CHAIN_ID < <($DIR/get-network-config $1)
  if [ $(process-pid $PORT) ]; then
    echo "Using blockchain running on $PORT"
  else
    run-geth $REFRESH $NETWORK_REF $PORT $CHAIN_ID
    echo "Started blockchain on $PORT"
    sleep 5 #wait for the geth process to start
    echo "PID: $(process-pid $PORT)"
  fi
}

start-geth $1
