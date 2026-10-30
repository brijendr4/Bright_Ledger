import { network } from 'hardhat'

const connection = await network.connect()
const [deployer] = await connection.ethers.getSigners()
if (!deployer) {
  throw new Error('No deployer account configured. Set DEPLOYER_PRIVATE_KEY to a rotated test-wallet key in blockchain/.env.')
}
const chainId = Number((await connection.ethers.provider.getNetwork()).chainId)
const sepoliaEthUsdFeed = '0x694AA1769357215DE4FAC081bf1f309aDC325306'
const priceFeed = chainId === 11155111
  ? process.env.ETH_USD_FEED_ADDRESS?.trim() || sepoliaEthUsdFeed
  : '0x0000000000000000000000000000000000000000'
const contract = await connection.ethers.deployContract('EnergyTrading', [deployer.address, priceFeed])
await contract.waitForDeployment()
console.log(`EnergyTrading deployed to ${await contract.getAddress()}`)
const boa = await connection.ethers.deployContract('BondedOperatorAssurance', [deployer.address])
await boa.waitForDeployment()
console.log(`BondedOperatorAssurance deployed to ${await boa.getAddress()}`)
console.log(`Owner/verifier: ${deployer.address}`)
console.log(`ETH/USD price feed: ${priceFeed}`)
