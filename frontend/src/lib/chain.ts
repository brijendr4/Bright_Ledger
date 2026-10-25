import { apiGet, getCurrentUser } from './api'
import { getActiveEvmWallet } from './wallet'

type ChainConfig = { chain: { enabled: boolean; paymentsEnabled: boolean; chainId: number; contractAddress: string | null } }

const abi = [
  'function quotePayment(uint64 energyWh,uint128 pricePerKWhScaled) view returns (uint256 paymentWei,uint256 ethUsdPrice)',
  'function commitTrade(bytes32 tradeId,address buyer,address seller,uint64 energyWh,uint128 pricePerKWhScaled) payable',
  'function reviewEvidence(bytes32 tradeId,bool approved,bytes32 reasonHash)',
  'function approveEvidenceAndSettle(bytes32 tradeId,bytes32 evidenceHash)',
  'function raiseDispute(bytes32 tradeId,bytes32 evidenceHash,bytes32 reasonHash)',
  'function resolveDispute(bytes32 tradeId,bool approved,bytes32 reasonHash)',
  'function settleTrade(bytes32 tradeId)',
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
  return { chain, contract }
}

async function sendContract(method: string, args: readonly unknown[], overrides?: { value: bigint }) {
  const { contract } = await contractContext()
  const transaction = await contract.getFunction(method)(...args, ...(overrides ? [overrides] : []))
  const receipt = await transaction.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The wallet transaction did not confirm successfully.')
  return receipt.hash
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
  return sendContract('approveEvidenceAndSettle', [id(tradeId), evidenceHash])
}

export async function raiseDisputeOnChain(tradeId: string, evidenceHash: string, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  return sendContract('raiseDispute', [id(tradeId), evidenceHash, keccak256(toUtf8Bytes(reason))])
}

export async function resolveDisputeOnChain(tradeId: string, approved: boolean, reason: string) {
  const { id, keccak256, toUtf8Bytes } = await import('ethers')
  return sendContract('resolveDispute', [id(tradeId), approved, keccak256(toUtf8Bytes(reason))])
}

export async function settleTradeOnChain(tradeId: string) {
  const { id } = await import('ethers')
  return sendContract('settleTrade', [id(tradeId)])
}
