import { apiGet } from './api'

type ChainConfig = { chain: { enabled: boolean; chainId: number; contractAddress: string | null } }

const abi = [
  'function commitTrade(bytes32 tradeId,address buyer,address seller,uint64 energyWh,uint128 pricePerKWhScaled)',
  'function submitEvidence(bytes32 tradeId,bytes32 evidenceHash)',
  'function reviewEvidence(bytes32 tradeId,bool approved,bytes32 reasonHash)',
  'function settleTrade(bytes32 tradeId)',
]

async function sendContract(method: string, args: readonly unknown[]) {
  const { BrowserProvider, Contract } = await import('ethers')
  if (!window.ethereum) throw new Error('An injected EVM wallet is required for this on-chain action.')
  const { chain } = await apiGet<ChainConfig>('/api/config')
  if (!chain.enabled || !chain.contractAddress) throw new Error('No deployed trading contract is configured.')
  const provider = new BrowserProvider(window.ethereum)
  const network = await provider.getNetwork()
  if (network.chainId !== BigInt(chain.chainId)) {
    throw new Error(`Switch your wallet to the configured chain (ID ${chain.chainId}) and retry.`)
  }
  const signer = await provider.getSigner()
  const contract = new Contract(chain.contractAddress, abi, signer)
  const transaction = await contract.getFunction(method)(...args)
  const receipt = await transaction.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The wallet transaction did not confirm successfully.')
  return receipt.hash
}

export async function commitTradeOnChain(trade: {
  id: string
  quantity: number
  price: number
  buyerWalletAddress?: string | null
  sellerWalletAddress?: string | null
}) {
  const { id } = await import('ethers')
  if (!trade.buyerWalletAddress || !trade.sellerWalletAddress) {
    throw new Error('Both trade participants must sign in with a wallet before this trade can be committed on-chain.')
  }
  return sendContract('commitTrade', [
    id(trade.id),
    trade.buyerWalletAddress,
    trade.sellerWalletAddress,
    BigInt(Math.round(trade.quantity * 1000)),
    BigInt(Math.round(trade.price * 10_000)),
  ])
}

export async function makeEvidenceHash(input: {
  tradeId: string
  quantity: number
  source: string
  intervalStart: string
  intervalEnd: string
  reference: string
  evidenceFileSha256?: string
}): Promise<string> {
  const { keccak256, toUtf8Bytes } = await import('ethers')
  return keccak256(toUtf8Bytes(JSON.stringify({
    tradeId: input.tradeId,
    quantity: input.quantity,
    source: input.source,
    intervalStart: input.intervalStart,
    intervalEnd: input.intervalEnd,
    reference: input.reference,
    ...(input.evidenceFileSha256 ? { evidenceFileSha256: input.evidenceFileSha256 } : {}),
  })))
}

export async function submitEvidenceOnChain(tradeId: string, evidenceHash: string) {
  const { id } = await import('ethers')
  return sendContract('submitEvidence', [id(tradeId), evidenceHash])
}

export async function reviewEvidenceOnChain(tradeId: string, approved: boolean, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  return sendContract('reviewEvidence', [id(tradeId), approved, keccak256(toUtf8Bytes(reason))])
}

export async function settleTradeOnChain(tradeId: string) {
  const { id } = await import('ethers')
  return sendContract('settleTrade', [id(tradeId)])
}
