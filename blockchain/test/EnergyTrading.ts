import assert from 'node:assert/strict'
import { describe, it } from 'mocha'
import { network } from 'hardhat'

describe('EnergyTrading', function () {
  it('restricts commitment to the named buyer or seller and rejects duplicates', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, outsider] = await ethers.getSigners()
    const contract = await ethers.deployContract('EnergyTrading', [owner.address])
    const tradeId = ethers.id('trade-duplicate')
    const args = [tradeId, buyer.address, seller.address, 12_400n, 51_000n] as const

    await assert.rejects(contract.connect(outsider).commitTrade(...args))
    await contract.connect(buyer).commitTrade(...args)
    await assert.rejects(contract.connect(seller).commitTrade(...args))
  })

  it('requires seller evidence, independent verifier approval, then permits one settlement', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, verifier, outsider] = await ethers.getSigners()
    const contract = await ethers.deployContract('EnergyTrading', [owner.address])
    const tradeId = ethers.id('trade-evidence')
    const evidenceHash = ethers.id('evidence')
    await contract.setVerifier(verifier.address, true)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 8_000n, 49_000n)

    await assert.rejects(contract.connect(buyer).submitEvidence(tradeId, evidenceHash))
    await contract.connect(seller).submitEvidence(tradeId, evidenceHash)
    await assert.rejects(contract.connect(seller).reviewEvidence(tradeId, true, ethers.ZeroHash))
    await assert.rejects(contract.connect(outsider).reviewEvidence(tradeId, true, ethers.ZeroHash))
    await assert.rejects(contract.connect(buyer).settleTrade(tradeId))

    await contract.connect(verifier).reviewEvidence(tradeId, true, ethers.ZeroHash)
    await contract.connect(buyer).settleTrade(tradeId)
    const settled = await contract.getTrade(tradeId)
    assert.equal(settled.status, 5n)
    assert.equal(await contract.demoPoints(buyer.address), 80n)
    assert.equal(await contract.demoPoints(seller.address), 80n)
    await assert.rejects(contract.connect(seller).settleTrade(tradeId))
  })

  it('records a dispute when a verifier rejects evidence', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller] = await ethers.getSigners()
    const contract = await ethers.deployContract('EnergyTrading', [owner.address])
    const tradeId = ethers.id('trade-disputed')
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 1_000n, 10_000n)
    await contract.connect(seller).submitEvidence(tradeId, ethers.id('bad-evidence'))
    await contract.reviewEvidence(tradeId, false, ethers.id('reason'))
    const disputed = await contract.getTrade(tradeId)
    assert.equal(disputed.status, 4n)
    await assert.rejects(contract.connect(buyer).settleTrade(tradeId))
  })
})
