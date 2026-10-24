import { network } from 'hardhat'

const connection = await network.connect()
const [deployer] = await connection.ethers.getSigners()
const contract = await connection.ethers.deployContract('EnergyTrading', [deployer.address])
await contract.waitForDeployment()
console.log(`EnergyTrading deployed to ${await contract.getAddress()}`)
console.log(`Owner/verifier: ${deployer.address}`)
