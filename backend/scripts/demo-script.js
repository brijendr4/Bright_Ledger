import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const backendEnvFile = resolve(scriptDirectory, '../.env')
const rootEnvFile = resolve(scriptDirectory, '../../.env')
dotenv.config({ path: existsSync(backendEnvFile) ? backendEnvFile : rootEnvFile })

async function rpc(method) {
  const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params: [] }),
  })
  if (!response.ok) throw new Error(`Alchemy returned HTTP ${response.status}.`)

  const result = await response.json()
  if (result.error) throw new Error(`RPC ${method} failed: ${result.error.message}`)
  if (typeof result.result !== 'string') throw new Error(`RPC ${method} returned an invalid result.`)
  return result.result
}

async function main() {
  if (!process.env.ALCHEMY_API_KEY) {
    throw new Error('Set ALCHEMY_API_KEY in your root .env file before running this demo.')
  }

  const [chainId, blockNumber] = await Promise.all([
    rpc('eth_chainId'),
    rpc('eth_blockNumber'),
  ])

  console.log(JSON.stringify({
    network: 'Ethereum Mainnet',
    chainId: Number(BigInt(chainId)),
    latestBlockNumber: Number(BigInt(blockNumber)),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Alchemy RPC request failed.')
  process.exitCode = 1
})