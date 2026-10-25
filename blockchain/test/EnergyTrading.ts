import assert from 'node:assert/strict'
import { describe, it } from 'mocha'
import { network } from 'hardhat'

describe('EnergyTrading', function () {
  it('restricts commitment to the named buyer or seller and rejects duplicates', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, outsider] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-duplicate')
    const args = [tradeId, buyer.address, seller.address, 12_400n, 51_000n] as const

    await assert.rejects(contract.connect(outsider).commitTrade(...args))
    const [paymentWei] = await contract.quotePayment(args[3], args[4])
    await contract.connect(buyer).commitTrade(...args, { value: paymentWei })
    await assert.rejects(contract.connect(seller).commitTrade(...args))
  })

  it('retains the legacy evidence-review path for existing contract integrations', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, verifier, outsider] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-evidence')
    const evidenceHash = ethers.id('evidence')
    await contract.setVerifier(verifier.address, true)
    const [paymentWei] = await contract.quotePayment(8_000n, 49_000n)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 8_000n, 49_000n, { value: paymentWei })
    assert.equal(await contract.escrowedWei(tradeId), paymentWei)
    assert.equal(buyerBalanceBefore - await ethers.provider.getBalance(buyer.address) > paymentWei, true)

    await assert.rejects(contract.connect(buyer).submitEvidence(tradeId, evidenceHash))
    await contract.connect(seller).submitEvidence(tradeId, evidenceHash)
    await assert.rejects(contract.connect(seller).reviewEvidence(tradeId, true, ethers.ZeroHash))
    await assert.rejects(contract.connect(outsider).reviewEvidence(tradeId, true, ethers.ZeroHash))
    await assert.rejects(contract.connect(buyer).settleTrade(tradeId))

    await contract.connect(verifier).reviewEvidence(tradeId, true, ethers.ZeroHash)
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    await contract.connect(buyer).settleTrade(tradeId)
    const settled = await contract.getTrade(tradeId)
    assert.equal(settled.status, 5n)
    assert.equal((await ethers.provider.getBalance(seller.address)) - sellerBalanceBefore, paymentWei)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
    assert.equal(await contract.demoPoints(buyer.address), 80n)
    assert.equal(await contract.demoPoints(seller.address), 80n)
    await assert.rejects(contract.connect(seller).settleTrade(tradeId))
  })

  it('lets the buyer approve delivery and release escrow without a seller payment transaction', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-buyer-approval')
    const evidenceHash = ethers.id('delivery-evidence')
    const [paymentWei] = await contract.quotePayment(8_000n, 49_000n)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 8_000n, 49_000n, { value: paymentWei })

    await assert.rejects(contract.connect(seller).approveEvidenceAndSettle(tradeId, evidenceHash))
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    await contract.connect(buyer).approveEvidenceAndSettle(tradeId, evidenceHash)

    const settled = await contract.getTrade(tradeId)
    assert.equal(settled.status, 5n)
    assert.equal(settled.evidenceHash, evidenceHash)
    assert.equal((await ethers.provider.getBalance(seller.address)) - sellerBalanceBefore, paymentWei)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
  })

  it('keeps escrow locked during a buyer dispute and lets an operator resolve it', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, verifier, outsider] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-dispute-resolution')
    const evidenceHash = ethers.id('disputed-delivery')
    const [paymentWei] = await contract.quotePayment(8_000n, 49_000n)
    await contract.setVerifier(verifier.address, true)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 8_000n, 49_000n, { value: paymentWei })

    await contract.connect(buyer).raiseDispute(tradeId, evidenceHash, ethers.id('buyer-reason'))
    assert.equal((await contract.getTrade(tradeId)).status, 4n)
    assert.equal(await contract.escrowedWei(tradeId), paymentWei)
    await assert.rejects(contract.connect(outsider).resolveDispute(tradeId, true, ethers.ZeroHash))

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    await contract.connect(verifier).resolveDispute(tradeId, true, ethers.ZeroHash)
    assert.equal((await contract.getTrade(tradeId)).status, 5n)
    assert.equal((await ethers.provider.getBalance(seller.address)) - sellerBalanceBefore, paymentWei)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
  })

  it('refunds escrow to the buyer when the verifier resolves the dispute for them', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller, verifier] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-dispute-refund')
    const [paymentWei] = await contract.quotePayment(8_000n, 49_000n)
    await contract.setVerifier(verifier.address, true)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 8_000n, 49_000n, { value: paymentWei })
    await contract.connect(buyer).raiseDispute(tradeId, ethers.id('disputed-delivery'), ethers.id('buyer-reason'))
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)

    await contract.connect(verifier).resolveDispute(tradeId, false, ethers.id('refund-reason'))

    assert.equal((await contract.getTrade(tradeId)).status, 6n)
    assert.equal((await ethers.provider.getBalance(buyer.address)) - buyerBalanceBefore, paymentWei)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
  })

  it('refunds the buyer when a verifier rejects evidence', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-disputed')
    const [paymentWei] = await contract.quotePayment(1_000n, 10_000n)
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 1_000n, 10_000n, { value: paymentWei })
    await contract.connect(seller).submitEvidence(tradeId, ethers.id('bad-evidence'))
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    await contract.reviewEvidence(tradeId, false, ethers.id('reason'))
    const disputed = await contract.getTrade(tradeId)
    assert.equal(disputed.status, 4n)
    assert.equal((await ethers.provider.getBalance(buyer.address)) - buyerBalanceBefore, paymentWei)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
    await assert.rejects(contract.connect(buyer).settleTrade(tradeId))
    await assert.rejects(contract.connect(seller).submitEvidence(tradeId, ethers.id('resubmission')))
  })

  it('rejects payments that differ from the fresh ETH/USD quote', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller] = await ethers.getSigners()
    const feed = await ethers.deployContract('MockETHUSDFeed', [2000_00000000n])
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, await feed.getAddress()])
    const tradeId = ethers.id('trade-underpaid')
    const [paymentWei] = await contract.quotePayment(1_000n, 10_000n)
    await assert.rejects(contract.connect(buyer).commitTrade(
      tradeId, buyer.address, seller.address, 1_000n, 10_000n, { value: paymentWei - 1n },
    ))
  })

  it('keeps local deployments record-only when no price feed is configured', async function () {
    const { ethers } = await network.connect()
    const [owner, buyer, seller] = await ethers.getSigners()
    const contract = await ethers.deployContract('EnergyTrading', [owner.address, ethers.ZeroAddress])
    const tradeId = ethers.id('local-record-only')
    await contract.connect(buyer).commitTrade(tradeId, buyer.address, seller.address, 1_000n, 10_000n)
    assert.equal(await contract.escrowedWei(tradeId), 0n)
    await assert.rejects(contract.quotePayment(1_000n, 10_000n))
  })
})
