import assert from 'node:assert/strict'
import { describe, it } from 'mocha'
import { network } from 'hardhat'

describe('BondedOperatorAssurance', function () {
  it('keeps the operator bond separate and gates release and slashing', async function () {
    const { ethers } = await network.connect()
    const [governance, operator, verifier, outsider] = await ethers.getSigners()
    const boa = await ethers.deployContract('BondedOperatorAssurance', [governance.address])
    await boa.setVerifier(verifier.address, true)
    const projectId = ethers.id('project-1')
    const milestoneId = ethers.id('site')
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 3600)

    await boa.connect(operator).postBond(projectId, unlockAt, { value: ethers.parseEther('1') })
    await assert.rejects(boa.connect(outsider).releaseBond(projectId))
    await boa.connect(operator).submitMilestone(projectId, milestoneId, ethers.id('evidence'))
    await boa.connect(verifier).reviewMilestone(projectId, milestoneId, true, ethers.ZeroHash)
    await boa.connect(verifier).slashBond(projectId, ethers.parseEther('0.25'), ethers.id('fraud'))

    const bond = await boa.bonds(projectId)
    assert.equal(bond.amount, ethers.parseEther('1'))
    assert.equal(bond.slashed, ethers.parseEther('0.25'))
    assert.equal(bond.released, false)
  })
})
