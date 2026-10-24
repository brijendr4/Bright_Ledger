import { defineConfig } from 'hardhat/config'
import hardhatEthers from '@nomicfoundation/hardhat-ethers'
import hardhatMocha from '@nomicfoundation/hardhat-mocha'

export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: { type: 'http', url: 'http://127.0.0.1:8545', chainId: 31337 },
  },
  test: { mocha: { timeout: 20_000 } },
})
