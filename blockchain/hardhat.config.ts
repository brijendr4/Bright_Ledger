import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'hardhat/config'
import hardhatEthers from '@nomicfoundation/hardhat-ethers'
import hardhatMocha from '@nomicfoundation/hardhat-mocha'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const localEnvFile = resolve(moduleDirectory, '.env')
const rootEnvFile = resolve(moduleDirectory, '../.env')
dotenv.config({ path: existsSync(localEnvFile) ? localEnvFile : rootEnvFile })

const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL || (
  process.env.BASE_SEPOLIA_ALCHEMY_API_KEY
    ? `https://base-sepolia.g.alchemy.com/v2/${process.env.BASE_SEPOLIA_ALCHEMY_API_KEY}`
    : undefined
)

export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: { type: 'http', url: 'http://127.0.0.1:8545', chainId: 31337 },
    ...(baseSepoliaRpcUrl ? {
      baseSepolia: {
        type: 'http',
        url: baseSepoliaRpcUrl,
        chainId: 84532,
        accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      },
    } : {}),
  },
  test: { mocha: { timeout: 20_000 } },
})
