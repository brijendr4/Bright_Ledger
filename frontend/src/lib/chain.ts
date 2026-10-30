import { apiGet, getCurrentUser } from './api'
import { getActiveEvmWallet } from './wallet'

type ChainConfig = { chain: { enabled: boolean; paymentsEnabled: boolean; chainId: number; contractAddress: string | null; boaEnabled: boolean; boaContractAddress: string | null } }

const abi = [
  'function quotePayment(uint64 energyWh,uint128 pricePerKWhScaled) view returns (uint256 paymentWei,uint256 ethUsdPrice)',
  'function commitTrade(bytes32 tradeId,address buyer,address seller,uint64 energyWh,uint128 pricePerKWhScaled) payable',
  'function reviewEvidence(bytes32 tradeId,bool approved,bytes32 reasonHash)',
  'function approveEvidenceAndSettle(bytes32 tradeId,bytes32 evidenceHash)',
  'function raiseDispute(bytes32 tradeId,bytes32 evidenceHash,bytes32 reasonHash)',
  'function resolveDispute(bytes32 tradeId,bool approved,bytes32 reasonHash)',
  'function settleTrade(bytes32 tradeId)',
  'function getTrade(bytes32 tradeId) view returns (tuple(address buyer,address seller,uint64 energyWh,uint128 pricePerKWhScaled,uint8 status,bytes32 evidenceHash))',
  'function escrowedWei(bytes32 tradeId) view returns (uint256)',
]

const boaAbi = [
  'function postBond(bytes32 projectId,uint64 unlockAt) payable',
  'function submitMilestone(bytes32 projectId,bytes32 milestoneId,bytes32 evidenceHash)',
  'function reviewMilestone(bytes32 projectId,bytes32 milestoneId,bool approved,bytes32 reasonHash)',
  'function releaseBond(bytes32 projectId)',
]

async function contractContext() {
  const { BrowserProvider, Contract } = await import('ethers')
  const wallet = getActiveEvmWallet()
  if (!wallet) throw new Error('Select an EVM wallet in this browser for this on-chain action.')
  const { chain } = await apiGet<ChainConfig>('/api/config')
  if (!chain.enabled || !chain.contractAddress) throw new Error('No deployed trading contract is configured.')
  const provider = new BrowserProvider(wallet)
  const network = await provider.getNetwork()
  if (network.chainId !== BigInt(chain.chainId)) {
    throw new Error(`Switch your wallet to the configured chain (ID ${chain.chainId}) and retry.`)
  }
  const signer = await provider.getSigner()
  const user = await getCurrentUser()
  if (!user.walletAddress) throw new Error('Link an EVM wallet in Settings before making a blockchain transaction.')
  if (signer.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new Error('The selected wallet does not match the EVM wallet linked to this Bright Ledger account.')
  }
  const contract = new Contract(chain.contractAddress, abi, signer)
  return { chain, contract, walletAddress: signer.address }
}

async function sendContractCall(
  contract: Awaited<ReturnType<typeof contractContext>>['contract'],
  method: string,
  args: readonly unknown[],
  overrides?: { value: bigint },
) {
  const transaction = await contract.getFunction(method)(...args, ...(overrides ? [overrides] : []))
  const receipt = await transaction.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The wallet transaction did not confirm successfully.')
  return receipt.hash
}

async function sendContract(method: string, args: readonly unknown[], overrides?: { value: bigint }) {
  const { contract } = await contractContext()
  return sendContractCall(contract, method, args, overrides)
}

async function validateBuyerReview(
  tradeId: string,
  evidenceHash: string,
  context: Awaited<ReturnType<typeof contractContext>>,
) {
  const { id, ZeroAddress, ZeroHash, getAddress } = await import('ethers')
  const hash = id(tradeId)
  const [trade] = await context.contract.getFunction('getTrade')(hash) as [{
    buyer: string
    status: bigint
    evidenceHash: string
  }]
  if (trade.buyer === ZeroAddress) {
    throw new Error(`Trade ${tradeId} has no escrow commitment on the configured contract. Confirm the buyer funded this exact trade on the current contract.`)
  }
  if (getAddress(trade.buyer) !== getAddress(context.walletAddress)) {
    throw new Error(`The connected wallet is not the buyer recorded for trade ${tradeId}.`)
  }
  if (Number(trade.status) !== 1) {
    const status = ['not found', 'awaiting delivery review', 'evidence submitted', 'approved', 'disputed', 'settled', 'refunded'][Number(trade.status)] ?? 'in an unknown state'
    throw new Error(`Trade ${tradeId} is ${status} on-chain and cannot be approved or disputed again.`)
  }
  if (evidenceHash === ZeroHash) {
    throw new Error('The evidence record has no valid hash. Refresh the page and select the evidence again.')
  }
  if (context.chain.paymentsEnabled) {
    const escrow = await context.contract.getFunction('escrowedWei')(hash) as bigint
    if (escrow === 0n) {
      throw new Error(`Trade ${tradeId} has no escrow remaining on this contract. Do not retry until you verify its commitment transaction.`)
    }
  }
}

export async function getTradePaymentQuote(trade: { quantity: number; price: number }) {
  const { formatEther } = await import('ethers')
  const { chain, contract } = await contractContext()
  if (!chain.paymentsEnabled) throw new Error('Native ETH escrow is enabled only for Ethereum Sepolia deployments.')
  const energyWh = BigInt(Math.round(trade.quantity * 1000))
  const pricePerKWhScaled = BigInt(Math.round(trade.price * 10_000))
  const [paymentWei, ethUsdPrice] = await contract.getFunction('quotePayment')(energyWh, pricePerKWhScaled) as [bigint, bigint]
  return {
    paymentWei: BigInt(paymentWei),
    paymentEth: formatEther(paymentWei),
    ethUsdPrice: Number(ethUsdPrice) / 1e8,
  }
}

export async function commitTradeOnChain(trade: {
  id: string
  quantity: number
  price: number
  buyerWalletAddress?: string | null
  sellerWalletAddress?: string | null
}, quotedPaymentWei?: bigint) {
  const { id } = await import('ethers')
  if (!trade.buyerWalletAddress || !trade.sellerWalletAddress) {
    throw new Error('Both trade participants must sign in with a wallet before this trade can be committed on-chain.')
  }
  const { chain } = await apiGet<ChainConfig>('/api/config')
  const paymentWei = chain.paymentsEnabled
    ? quotedPaymentWei ?? (await getTradePaymentQuote(trade)).paymentWei
    : undefined
  return sendContract('commitTrade', [
    id(trade.id),
    trade.buyerWalletAddress,
    trade.sellerWalletAddress,
    BigInt(Math.round(trade.quantity * 1000)),
    BigInt(Math.round(trade.price * 10_000)),
  ], paymentWei === undefined ? undefined : { value: paymentWei })
}

export async function approveEvidenceOnChain(tradeId: string, evidenceHash: string) {
  const { id } = await import('ethers')
  const context = await contractContext()
  await validateBuyerReview(tradeId, evidenceHash, context)
  return sendContractCall(context.contract, 'approveEvidenceAndSettle', [id(tradeId), evidenceHash])
}

export async function raiseDisputeOnChain(tradeId: string, evidenceHash: string, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  const context = await contractContext()
  await validateBuyerReview(tradeId, evidenceHash, context)
  return sendContractCall(context.contract, 'raiseDispute', [id(tradeId), evidenceHash, keccak256(toUtf8Bytes(reason))])
}

export async function resolveDisputeOnChain(tradeId: string, approved: boolean, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  return sendContract('resolveDispute', [id(tradeId), approved, keccak256(toUtf8Bytes(reason))])
}

export async function settleTradeOnChain(tradeId: string) {
  const { id } = await import('ethers')
  return sendContract('settleTrade', [id(tradeId)])
}

async function boaContext() {
  const { BrowserProvider, Contract } = await import('ethers')
  const wallet = getActiveEvmWallet()
  if (!wallet) throw new Error('Select an EVM wallet in this browser for the operator bond action.')
  const { chain } = await apiGet<ChainConfig>('/api/config')
  if (!chain.boaEnabled || !chain.boaContractAddress) throw new Error('No Bonded Operator Assurance contract is configured.')
  const provider = new BrowserProvider(wallet)
  const network = await provider.getNetwork()
  if (network.chainId !== BigInt(chain.chainId)) throw new Error(`Switch your wallet to the configured chain (ID ${chain.chainId}) and retry.`)
  const signer = await provider.getSigner()
  const user = await getCurrentUser()
  if (!user.walletAddress || signer.address.toLowerCase() !== user.walletAddress.toLowerCase()) throw new Error('The selected wallet does not match this Bright Ledger account.')
  return { contract: new Contract(chain.boaContractAddress, boaAbi, signer) }
}

export async function postOperatorBondOnChain(projectId: string, unlockAt: Date, amountWei: bigint) {
  const { id } = await import('ethers')
  const { contract } = await boaContext()
  const tx = await contract.getFunction('postBond')(id(projectId), Math.floor(unlockAt.getTime() / 1000), { value: amountWei })
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The operator bond transaction did not confirm successfully.')
  return receipt.hash
}

export async function submitOperatorMilestoneOnChain(projectId: string, milestoneId: string, evidenceHash: string) {
  const { id } = await import('ethers')
  const { contract } = await boaContext()
  const tx = await contract.getFunction('submitMilestone')(id(projectId), id(milestoneId), evidenceHash)
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The milestone transaction did not confirm successfully.')
  return receipt.hash
}

export async function reviewOperatorMilestoneOnChain(projectId: string, milestoneId: string, approved: boolean, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  const { contract } = await boaContext()
  const tx = await contract.getFunction('reviewMilestone')(id(projectId), id(milestoneId), approved, keccak256(toUtf8Bytes(reason)))
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The milestone review transaction did not confirm successfully.')
  return receipt.hash
}
