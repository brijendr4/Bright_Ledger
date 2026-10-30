import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bolt,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Leaf,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { apiGet, apiGetBlob, apiPatch, apiPost, apiUpload, ApiError, authenticatePassword, clearAccessToken, clearLegacyAccessToken, getCurrentUser, hasAccessToken, linkWalletWithSignature, removeWalletAccountWithSignature, revokeWalletSession, signInWallet } from './lib/api'
import { approveEvidenceOnChain, commitTradeOnChain, getTradePaymentQuote, postOperatorBondOnChain, raiseDisputeOnChain, resolveDisputeOnChain, reviewOperatorMilestoneOnChain, settleTradeOnChain, submitOperatorMilestoneOnChain } from './lib/chain'
import { discoverEvmWallets, getActiveEvmWallet, selectEvmWallet, type EvmWalletInfo } from './lib/wallet'
import './App.css'

type Page = 'Overview' | 'Energy market' | 'My offers' | 'My requests' | 'Trades' | 'Evidence' | 'Rewards' | 'Solar projects' | 'Activity' | 'Settings'
type Role = 'Energy Producer' | 'Energy Consumer' | 'Producer & Consumer' | 'Verifier' | 'Admin' | 'Investor' | 'Project Owner'
type MarketplaceRole = 'prosumer' | 'consumer' | 'both' | 'funder'
type Listing = {
  id: string
  type: 'offer' | 'request'
  owner: string
  quantity: number
  price: number
  area: string
  source: string
  window: string
  status: string
  isMine?: boolean
}
type Trade = {
  id: string
  buyer: string
  seller: string
  quantity: number
  price: number
  status: string
  time: string
  hash: string
  buyerWalletAddress?: string | null
  sellerWalletAddress?: string | null
  hasConfirmed?: boolean
}
type EvidenceAiAnalysis = { summary: string; confidence: 'low' | 'medium' | 'high'; flags: string[]; suggestedChecks: string[] }
type EvidenceAiReview = { id: string; fileSha256: string; model: string; analysis: EvidenceAiAnalysis }
type Evidence = { id: string; project: string; source: string; quantity: number; interval: string; status: 'Pending' | 'Approved' | 'Rejected' | 'Disputed'; trade: string; evidenceHash: string; buyerCanReview: boolean; tradeStatus: string; reason?: string; reference?: string; evidenceFileSha256?: string; evidenceFileAvailable?: boolean; aiReview?: EvidenceAiReview | null }
type Project = { id: string; name: string; location: string; area: number; target: number; raised: number; capacity: number; owner: string; ownerId?: string; status: string; image: string; siteType: string; permission: string; notes: string; estimateModel: string; fundingMethodology: string; estimateReviewSummary: string; estimateReviewConfidence: string; estimateLimitation: string; revenueShares: { owner: number; funder: number; community: number }; incomeDistributions: { id: string; amountMinor: number; source: string; createdAt: string; allocations: { recipient: string; type: string; amountMinor: number }[] }[] }
type Contribution = { id: string; projectId: string; contributor: string; amount: number; time: string; status: string }
type SolarWorkspaceData = {
  project: { id: string; siteId: string; name: string; owner: string; status: string; capacityKwp: number; fundingTargetMinor: number; fundingDeadline: string; agreementHash: string | null; allocationRules: { funderPct: number; ownerPct: number; operatorPct: number; reserveMinor: number; feeMinor: number; version: string } }
  site: { id: string; name: string; publicLocation: string; roofType: string; roofAreaM2: number; usableAreaM2: number; shadingPct: number; gridConnectionStatus: string; reviewStatus: string; estimate: { capacityKwp: number; dailyKwh: number; monthlyKwh: number; capexMinor: number; methodologyVersion: string; assumptions: { peakSunHours: number; performanceRatio: number; note: string } } | null } | null
  funding: { targetMinor: number; committedMinor: number; receivedMinor: number; remainingMinor: number; currency: string; contributions: { id: string; contributor: string; amountMinor: number; status: string; receipt: string }[] }
  generation: { verifiedWh: number; availableWh: number; batches: { id: string; energyWh: number; tradedWh: number; intervalStart: string; intervalEnd: string; sourceType: string; verificationStatus: string; anomalyFlags: string[]; allocatedWh: number }[] }
  market: { trades: { id: string; generationBatchId: string; energyWh: number; priceMinorPerKwh: number; grossAmountMinor: number; status: string }[] }
  attributes: { id: string; generationBatchId: string; energyWh: number; status: string; allocatedToTradeId: string; label: string }[]
  settlements: { id: string; status: string; distributablePoolMinor: number; finalizedAt: string }[]
  milestones: { id: string; title: string; status: string; evidenceReference?: string; evidenceHash?: string }[]
  timeline: { id: string; action: string; detail: string; actor: string; timestamp: string }[]
  disputes: { id: string; reason: string; status: string; resolution: string | null }[]
  impact: { simulatedKwh: number; availableKwh: number; estimatedKgCo2e: number; disclaimer: string; factor: { kgCo2ePerKwh: number; source: string; version: string } }
}
type ProjectFundingEstimateInput = {
  location: string
  siteType: string
  usableAreaM2: number
  costs: { equipmentUsd: number; installationUsd: number; permittingUsd: number; interconnectionUsd: number; otherUsd: number }
  contingencyPercent: number
  revenueShares: { owner: number; funder: number; community: number }
  consentToAi?: boolean
}
type ProjectFundingEstimate = {
  id: string
  requiredFundingUsd: number
  capacityKwp: number
  costBreakdown: { category: string; amountMinor: number }[]
  contingencyMinor: number
  aiReview: {
    model: string
    summary: string
    confidence: 'low' | 'medium' | 'high'
    flags: string[]
    suggestedChecks: string[]
    suggestedRevenueShares: { owner: number; funder: number; community: number }
  }
}
type SettlementPreview = { projectId: string; periodStart: string; periodEnd: string; grossProceedsMinor: number; operatingReserveMinor: number; platformFeeMinor: number; distributablePoolMinor: number; rulesVersion: string; allocations: { recipient: string; type: string; amountMinor: number }[]; inputHash: string; outputHash: string }
type BoaData = { enabled: boolean; bond: { amountWei: string; unlockAt: string; status: string; postTxHash: string; releaseTxHash?: string | null; slashedWei: string; operator: string } | null; milestones: { id: string; title: string; status: string; evidenceHash?: string | null; evidenceReference?: string | null }[] }
type AppState = { listings: Listing[]; trades: Trade[]; evidence: Evidence[]; projects: Project[]; contributions: Contribution[]; points: number; activity: { title: string; detail: string; time: string }[]; notifications: AppNotification[] }
type AppNotification = { id: string; title: string; detail: string; page: Page; readAt: string | null; createdAt: string }
type ApiSnapshot = {
  listings: (Omit<Listing, 'status'> & { status: string })[]
  trades: (Omit<Trade, 'status'> & { status: string })[]
  evidence: (Omit<Evidence, 'status' | 'aiReview'> & { status: string; aiReviewId?: string | null; aiModel?: string | null; aiReview?: EvidenceAiAnalysis | null })[]
  projects: (Omit<Project, 'status'> & { status: string })[]
  contributions: Contribution[]
  points: number
  activity: AppState['activity']
  notifications: AppNotification[]
}

const emptyState: AppState = { listings: [], trades: [], evidence: [], projects: [], contributions: [], points: 0, activity: [], notifications: [] }

const tourSteps: { page: Page; target: string; title: string; description: string }[] = [
  { page: 'Overview', target: 'overview', title: 'Your energy overview', description: 'Start here to see listed energy, trade records, recent activity, and evidence status. These are marketplace records—not proof that electricity was physically delivered.' },
  { page: 'Energy market', target: '.segmented-tabs', title: 'Compare offers and requests', description: 'Switch between Energy offers and Buy requests. Compare each listing’s quantity, seller-set USD/kWh price, area, source, and delivery window before proposing a match.' },
  { page: 'My offers', target: 'offer-form', title: 'Create an energy offer', description: 'Choose Offer, then enter available energy in kWh, your asking price in USD/kWh, city and country, renewable source, and delivery window. The price is your choice; Bright Ledger does not calculate it.' },
  { page: 'My requests', target: 'request-form', title: 'Post a buyer request', description: 'Choose Request, then enter the energy quantity you need, the maximum USD/kWh you are willing to pay, your area, source preference, and delivery window. Matching is based on the listing terms.' },
  { page: 'Trades', target: '.trade-flow', title: 'Follow the trade workflow', description: 'Both participants confirm terms. The buyer funds configured escrow, the seller submits delivery evidence, and the buyer approves to complete the trade or opens a dispute.' },
  { page: 'Evidence', target: 'evidence', title: 'Submit and review evidence', description: 'The seller reports delivered kWh, selects a reading source and interval, and can attach meter or inverter evidence. The buyer reviews the record; AI checks are advisory only.' },
  { page: 'Solar projects', target: 'projects', title: 'Submit a community solar site', description: 'Add the site name, location, site type, usable area, permission status, notes, and an illustrative funding target. The capacity estimate is approximate; submissions need review and contributions are simulated.' },
]

const navigation: { label: Page; icon: typeof Activity; group: string }[] = [
  { label: 'Overview', icon: Activity, group: 'Workspace' },
  { label: 'Energy market', icon: Bolt, group: 'Workspace' },
  { label: 'My offers', icon: ArrowUpRight, group: 'Workspace' },
  { label: 'My requests', icon: ArrowDownRight, group: 'Workspace' },
  { label: 'Trades', icon: Zap, group: 'Trading' },
  { label: 'Evidence', icon: ShieldCheck, group: 'Trading' },
  { label: 'Rewards', icon: Leaf, group: 'Trading' },
  { label: 'Solar projects', icon: Sun, group: 'Community solar' },
  { label: 'Activity', icon: ClipboardCheck, group: 'Manage' },
  { label: 'Settings', icon: Settings, group: 'Manage' },
]

const formatUSD = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const tourKeyForAccount = (accountId: string) => `bright-ledger-tour-complete:${accountId}`
const explorerAddressUrl = (chainId: number | null, address: string) => {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    80002: 'https://amoy.polygonscan.com',
    84532: 'https://sepolia.basescan.org',
    11155111: 'https://sepolia.etherscan.io',
  }
  const base = chainId === null ? undefined : explorers[chainId]
  return base ? `${base}/address/${encodeURIComponent(address)}` : null
}
const evmNetworkName = (chainId: number) => ({
  1: 'Ethereum Mainnet',
  10: 'Optimism',
  137: 'Polygon PoS',
  8453: 'Base',
  42161: 'Arbitrum One',
  80002: 'Polygon Amoy',
  84532: 'Base Sepolia',
  11155111: 'Ethereum Sepolia',
  31337: 'Local EVM (development)',
}[chainId] ?? `EVM network ${chainId}`)
const pct = (raised: number, target: number) => Math.min(100, Math.round((raised / target) * 100))

function parseDeliveryWindow(label: string, now = new Date()) {
  const match = label.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?(?:\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i)
  if (!match) throw new Error('Choose a valid delivery window.')
  const toHour = (hour: string, minute: string, period?: string) => {
    let value = Number(hour) % 12
    if (period?.toUpperCase() === 'PM') value += 12
    return { hour: value, minute: Number(minute) }
  }
  const startTime = toHour(match[1], match[2], match[3] ?? match[6])
  const endTime = match[4] ? toHour(match[4], match[5], match[6]) : { hour: startTime.hour + 4, minute: startTime.minute }
  const start = new Date(now)
  start.setHours(startTime.hour, startTime.minute, 0, 0)
  if (/tomorrow/i.test(label) || start <= now) start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setHours(endTime.hour, endTime.minute, 0, 0)
  if (end <= start) end.setDate(end.getDate() + 1)
  return { deliveryStart: start.toISOString(), deliveryEnd: end.toISOString() }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <img className={compact ? 'brand-mark' : 'brand-logo'} src="/bright-ledger.svg" alt="Bright Ledger" />
}

function mapSnapshot(data: ApiSnapshot): AppState {
  const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  return {
    listings: data.listings.map((item) => ({ ...item, status: titleCase(item.status) })),
    trades: data.trades.map((item) => ({ ...item, status: item.status })),
    evidence: data.evidence.map((item) => ({
      ...item,
      status: titleCase(item.status) as Evidence['status'],
      aiReview: item.aiReview && item.aiReviewId && item.aiModel && item.evidenceFileSha256
        ? { id: item.aiReviewId, fileSha256: item.evidenceFileSha256, model: item.aiModel, analysis: item.aiReview }
        : null,
    })),
    projects: data.projects.map((item) => ({ ...item, status: titleCase(item.status) })),
    contributions: data.contributions.map((item) => ({ ...item, status: titleCase(item.status) })),
    points: data.points,
    activity: data.activity,
    notifications: data.notifications,
  }
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function App() {
  const mockApiEnabled = false
  const [state, setState] = useState<AppState>(emptyState)
  const [page, setPage] = useState<Page>('Overview')
  const [authenticatedWorkspace, setAuthenticatedWorkspace] = useState(false)
  const [role, setRole] = useState<Role>('Energy Producer')
  const [authMode, setAuthMode] = useState<'none' | 'wallet' | 'password'>('none')
  const [apiConnected, setApiConnected] = useState(false)
  const [chainEnabled, setChainEnabled] = useState(false)
  const [chainPaymentsEnabled, setChainPaymentsEnabled] = useState(false)
  const [apiBusy, setApiBusy] = useState(false)
  const [apiError, setApiError] = useState('')
  const [landingNotice, setLandingNotice] = useState('')
  const [identity, setIdentity] = useState('')
  const [accountUsername, setAccountUsername] = useState('')
  const [accountId, setAccountId] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [walletChainId, setWalletChainId] = useState<number | null>(null)
  const [configuredChainId, setConfiguredChainId] = useState<number | null>(null)
  const [contractAddress, setContractAddress] = useState<string | null>(null)
  const [walletDisplayName, setWalletDisplayName] = useState('')
  const [walletProviders, setWalletProviders] = useState<EvmWalletInfo[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [walletRole, setWalletRole] = useState<'prosumer' | 'consumer' | 'both' | 'funder'>('consumer')
  const [showDisclosure, setShowDisclosure] = useState(() => {
    try { return localStorage.getItem('bright-ledger-prototype-disclosure-v1') !== 'true' } catch { return true }
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('bright-ledger-theme')
      if (stored === 'dark' || stored === 'light') return stored
      return 'light'
    } catch {
      return 'light'
    }
  })
  const [query, setQuery] = useState('')
  const [marketTab, setMarketTab] = useState<'offers' | 'requests'>('offers')
  const [modal, setModal] = useState<'listing' | 'project' | 'match' | 'fund' | 'evidence' | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [solarWorkspaceId, setSolarWorkspaceId] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [toast, setToast] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountRemovalOpen, setAccountRemovalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All status')
  const [projectFilter, setProjectFilter] = useState('All projects')
  const [tourStep, setTourStep] = useState(-1)
  const [tourTargetRect, setTourTargetRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [aiEvidenceReview, setAiEvidenceReview] = useState<EvidenceAiReview | null>(null)
  const [aiEvidenceLoading, setAiEvidenceLoading] = useState(false)

  useEffect(() => {
    let active = true
    void discoverEvmWallets().then((wallets) => {
      if (!active) return
      setWalletProviders(wallets)
      if (wallets[0]) setSelectedWalletId(wallets[0].id)
    }).catch((error: unknown) => {
      if (active) setApiError(error instanceof Error ? error.message : 'Could not discover browser wallets.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    try {
      clearLegacyAccessToken()
    } catch {
      setApiError('The legacy browser token could not be cleared. Sign out and clear site data if this device is shared.')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('bright-ledger-theme', theme)
    } catch {
      setToast('Theme preference could not be saved in this browser.')
    }
  }, [theme])

  useEffect(() => {
    if (!authenticatedWorkspace) return
    let cancelled = false
    const initialize = async () => {
      const user = await getCurrentUser()
      const userRole: Record<string, Role> = { prosumer: 'Energy Producer', consumer: 'Energy Consumer', both: 'Producer & Consumer', verifier: 'Verifier', admin: 'Admin', funder: 'Investor', space_owner: 'Project Owner' }
      if (!cancelled) {
        setIdentity(user.displayName)
        setAccountUsername(user.username ?? '')
        setAccountId(user.id)
        setWalletAddress(user.walletAddress ?? '')
        setAuthMode(user.authMethod)
        setRole(userRole[user.role] ?? 'Energy Consumer')
      }
      const [snapshot, config] = await Promise.all([
        apiGet<ApiSnapshot>('/api/bootstrap'),
        apiGet<{ chain: { enabled: boolean; paymentsEnabled: boolean; chainId: number; contractAddress: string | null } }>('/api/config'),
      ])
      if (!cancelled) {
        setState(mapSnapshot(snapshot))
        setChainEnabled(config.chain.enabled)
        setChainPaymentsEnabled(config.chain.paymentsEnabled)
        setConfiguredChainId(config.chain.enabled ? config.chain.chainId : null)
        setContractAddress(config.chain.enabled ? config.chain.contractAddress : null)
        setApiConnected(true)
        let tourCompleted = false
        try {
          tourCompleted = localStorage.getItem(tourKeyForAccount(user.id)) === 'true'
        } catch {
          notify('Browser storage is unavailable. The guided tour may appear again next visit.')
        }
        if (!tourCompleted) {
          setPage('Overview')
          setTourStep(0)
        }
      }
    }
    void initialize().catch((error: unknown) => {
      if (!cancelled) {
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken()
          setAuthenticatedWorkspace(false)
          setAuthMode('none')
          setState(emptyState)
          setAccountId('')
          setIdentity('')
          setAccountUsername('')
          setWalletAddress('')
        }
        setApiConnected(false)
        setApiError(error instanceof ApiError ? error.message : 'Could not load Bright Ledger data.')
      }
    }).finally(() => {
      if (!cancelled) setApiBusy(false)
    })
    return () => { cancelled = true }
  }, [authenticatedWorkspace])

  useEffect(() => {
    if (!hasAccessToken()) return
    let cancelled = false
    setApiBusy(true)
    void getCurrentUser().then((user) => {
      if (cancelled) return
      setWalletAddress(user.walletAddress ?? '')
      setWalletDisplayName(user.displayName)
      setIdentity(user.displayName)
      setAccountUsername(user.username ?? '')
      setAccountId(user.id)
      const userRole: Record<string, Role> = { prosumer: 'Energy Producer', consumer: 'Energy Consumer', both: 'Producer & Consumer', verifier: 'Verifier', admin: 'Admin', funder: 'Investor', space_owner: 'Project Owner' }
      setRole(userRole[user.role] ?? 'Energy Consumer')
      setAuthMode(user.authMethod)
      setAuthenticatedWorkspace(true)
    }).catch((error: unknown) => {
      if (cancelled) return
      clearAccessToken()
      setApiError(error instanceof Error ? error.message : 'The saved account session could not be resumed.')
    }).finally(() => {
      if (!cancelled) setApiBusy(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAccessToken()
      setState(emptyState)
      setAccountId('')
      setIdentity('')
      setAccountUsername('')
      setWalletAddress('')
      setAuthMode('none')
      setAuthenticatedWorkspace(false)
      setApiConnected(false)
      setApiError('Your account session expired or was revoked. Sign in again to continue.')
      setPage('Overview')
    }
    window.addEventListener('bright-ledger:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('bright-ledger:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (!authenticatedWorkspace) return
    const interval = window.setInterval(() => {
      void refreshFromApi().catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) return
        setApiConnected(false)
        setApiError(error instanceof Error ? error.message : 'Could not refresh account activity.')
      })
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [authenticatedWorkspace])

  useEffect(() => {
    const ethereum = getActiveEvmWallet()
    if (!ethereum) return
    let active = true
    const updateChain = (value: unknown) => {
      if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) {
        setWalletChainId(null)
        return
      }
      const chainId = Number(BigInt(value))
      setWalletChainId(Number.isSafeInteger(chainId) ? chainId : null)
    }
    const onChainChanged = (value: unknown) => updateChain(value)
    const onAccountsChanged = (value: unknown) => {
      const nextAddress = Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
      if (authMode === 'wallet' && nextAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        void revokeWalletSession().catch((error: unknown) => {
          setToast(error instanceof Error ? `Wallet changed; session revocation could not be confirmed: ${error.message}` : 'Wallet changed; server session revocation could not be confirmed.')
        })
        clearAccessToken()
        setAuthenticatedWorkspace(false)
        setAuthMode('none')
        setAccountId('')
        setIdentity('')
        setAccountUsername('')
        setWalletAddress('')
        setState(emptyState)
        setApiConnected(false)
        setWalletDisplayName(identity)
        setPage('Overview')
        setApiError(nextAddress
          ? 'The active wallet account changed. Sign in again with the new account.'
          : 'The wallet disconnected. Sign in again to continue.')
      }
    }
    void ethereum.request({ method: 'eth_chainId' }).then((value) => {
      if (active) updateChain(value)
    }).catch(() => {
      if (active) setWalletChainId(null)
    })
    ethereum.on?.('chainChanged', onChainChanged)
    ethereum.on?.('accountsChanged', onAccountsChanged)
    return () => {
      active = false
      ethereum.removeListener?.('chainChanged', onChainChanged)
      ethereum.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [authMode, identity, selectedWalletId, walletAddress])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredTrades = state.trades.filter((trade) => {
    const matchesQuery = `${trade.id} ${trade.buyer} ${trade.seller}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'All status' || trade.status === statusFilter)
  })
  const filteredProjects = state.projects.filter((project) => `${project.name} ${project.location} ${project.owner}`.toLowerCase().includes(query.toLowerCase()) && (projectFilter === 'All projects' || project.status === projectFilter))
  const openOffers = state.listings.filter((listing) => listing.type === 'offer' && listing.status === 'Open')
  const totalOffered = state.listings.filter((listing) => listing.type === 'offer').reduce((sum, listing) => sum + listing.quantity, 0)
  const settledEnergy = state.trades.filter((trade) => trade.status === 'Settled').reduce((sum, trade) => sum + trade.quantity, 0)
  const pendingEvidence = state.evidence.filter((item) => item.status === 'Pending')
  const notifications = state.notifications
  const unreadNotifications = notifications.filter((item) => !item.readAt)

  function notify(message: string) {
    setToast(message)
  }

  async function markNotificationRead(id: string) {
    try {
      const response = await apiPatch<{ data: { id: string; readAt: string } }>(`/api/notifications/${encodeURIComponent(id)}/read`, {})
      setState((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, readAt: response.data.readAt } : item) }))
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Notification could not be marked as read.')
    }
  }

  async function markAllNotificationsRead() {
    try {
      await apiPost('/api/notifications/read-all', {})
      const readAt = new Date().toISOString()
      setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt ?? readAt })) }))
      notify('All notifications marked as read.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Notification read state could not be saved.')
    }
  }

  function signOut() {
    void revokeWalletSession().catch((error: unknown) => {
      notify(error instanceof Error ? `Signed out locally; server session revocation could not be confirmed: ${error.message}` : 'Signed out locally; server session revocation could not be confirmed.')
    })
    clearAccessToken()
    setAccountMenuOpen(false)
    setNotificationsOpen(false)
    setAccountRemovalOpen(false)
    setAccountId('')
    setIdentity('')
    setAccountUsername('')
    setWalletAddress('')
    setState(emptyState)
    setAuthMode('none')
    setAuthenticatedWorkspace(false)
    setApiConnected(false)
    setApiError('')
    setPage('Overview')
  }

  async function removeAccount() {
    if (!walletAddress) return
    setApiBusy(true)
    setApiError('')
    try {
      await removeWalletAccountWithSignature(walletAddress)
      clearAccessToken()
      try {
        localStorage.removeItem(tourKeyForAccount(accountId))
      } catch {
        notify('Account was removed, but local browser preferences could not be cleared.')
      }
      setAccountMenuOpen(false)
      setAccountRemovalOpen(false)
      setAccountId('')
      setWalletAddress('')
      setIdentity('')
      setAccountUsername('')
      setAuthMode('none')
      setAuthenticatedWorkspace(false)
      setApiConnected(false)
      setApiError('')
      setLandingNotice('Wallet profile removed. Existing marketplace records remain anonymized for audit history.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove the wallet profile.'
      setApiError(message)
      notify(message)
    } finally {
      setApiBusy(false)
    }
  }

  async function refreshFromApi() {
    const snapshot = await apiGet<ApiSnapshot>('/api/bootstrap')
    setState(mapSnapshot(snapshot))
    setApiConnected(true)
  }

  async function changeRole(nextRole: MarketplaceRole) {
    setApiBusy(true)
    try {
      await apiPatch<{ role: MarketplaceRole }>('/api/me/role', { role: nextRole })
      const labels: Record<MarketplaceRole, Role> = {
        prosumer: 'Energy Producer',
        consumer: 'Energy Consumer',
        both: 'Producer & Consumer',
        funder: 'Investor',
      }
      setRole(labels[nextRole])
      notify(`Profile role changed to ${labels[nextRole]}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not change your profile role.')
    } finally {
      setApiBusy(false)
    }
  }

  async function connectWallet() {
    const name = walletDisplayName.trim()
    if (name.length < 2) {
      notify('Enter a display name to create your wallet profile.')
      return
    }
    const selectedWallet = walletProviders.find((wallet) => wallet.id === selectedWalletId)
    if (!selectedWallet) {
      setApiError('No compatible EVM wallet was found. Install or enable a browser wallet, then refresh the wallet list.')
      return
    }
    setApiBusy(true)
    setApiError('')
    setLandingNotice('')
    try {
      selectEvmWallet(selectedWallet.id)
      const user = await signInWallet(name, walletRole, selectedWallet.provider)
      setIdentity(user.displayName)
      setAccountUsername(user.username ?? '')
      setAccountId(user.id)
      setWalletAddress(user.walletAddress ?? '')
      const userRole: Record<string, Role> = { prosumer: 'Energy Producer', consumer: 'Energy Consumer', both: 'Producer & Consumer', verifier: 'Verifier', admin: 'Admin', funder: 'Investor', space_owner: 'Project Owner' }
      setRole(userRole[user.role] ?? 'Energy Consumer')
      setAuthMode('wallet')
      setAuthenticatedWorkspace(true)
      acceptDisclosure()
      notify('Wallet account connected. Your private keys remain in your wallet.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet sign-in failed.'
      setApiError(message)
      notify(message)
      setApiBusy(false)
    }
  }

  async function connectPassword(input: {
    mode: 'register' | 'login'
    username: string
    password: string
    displayName?: string
    role?: 'prosumer' | 'consumer' | 'both' | 'funder'
  }) {
    setApiBusy(true)
    setApiError('')
    setLandingNotice('')
    try {
      const user = await authenticatePassword(input)
      setIdentity(user.displayName)
      setAccountUsername(user.username)
      setAccountId(user.id)
      setWalletAddress(user.walletAddress ?? '')
      const userRole: Record<string, Role> = { prosumer: 'Energy Producer', consumer: 'Energy Consumer', both: 'Producer & Consumer', verifier: 'Verifier', admin: 'Admin', funder: 'Investor', space_owner: 'Project Owner' }
      setRole(userRole[user.role] ?? 'Energy Consumer')
      setAuthMode('password')
      setAuthenticatedWorkspace(true)
      acceptDisclosure()
      notify(input.mode === 'register' ? 'Account created. Link an EVM wallet in Settings before using wallet-dependent features.' : 'Signed in to your Bright Ledger account.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password authentication failed.'
      setApiError(message)
      notify(message)
      setApiBusy(false)
    }
  }

  async function linkWallet() {
    const selectedWallet = walletProviders.find((wallet) => wallet.id === selectedWalletId)
    if (!selectedWallet) {
      setApiError('No compatible EVM wallet was found. Install or enable a browser wallet, then refresh the wallet list.')
      return
    }
    setApiBusy(true)
    setApiError('')
    try {
      selectEvmWallet(selectedWallet.id)
      const user = await linkWalletWithSignature(selectedWallet.provider)
      setWalletAddress(user.walletAddress)
      setIdentity(user.displayName)
      setAccountUsername(user.username ?? '')
      setAccountId(user.id)
      notify('EVM wallet linked after signature verification. Your private key remains in the wallet.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not link this EVM wallet.'
      setApiError(message)
      notify(message)
    } finally {
      setApiBusy(false)
    }
  }

  async function refreshWalletProviders() {
    setApiError('')
    try {
      const wallets = await discoverEvmWallets()
      setWalletProviders(wallets)
      if (wallets[0]) setSelectedWalletId(wallets[0].id)
      if (!wallets.length) setApiError('No EVM wallet was detected. Install or enable an EVM-compatible browser wallet, then retry.')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not refresh browser wallets.')
    }
  }

  function acceptDisclosure() {
    setShowDisclosure(false)
    try {
      localStorage.setItem('bright-ledger-prototype-disclosure-v1', 'true')
    } catch {
      notify('Browser storage is unavailable. This disclosure may appear again next visit.')
    }
  }

  function advanceTour() {
    const nextStep = tourStep === 0 ? 1 : tourStep + 1
    if (nextStep > tourSteps.length) {
      try {
        localStorage.setItem(tourKeyForAccount(accountId), 'true')
      } catch {
        notify('Tour completion could not be saved in this browser.')
      }
      setTourStep(-1)
      return
    }
    setTourStep(nextStep)
    setPage(tourSteps[nextStep - 1].page)
  }

  function previousTour() {
    if (tourStep <= 1) {
      setTourStep(0)
      return
    }
    const previousStep = tourStep - 1
    setTourStep(previousStep)
    setPage(tourSteps[previousStep - 1].page)
  }

  function startTour() {
    setPage('Overview')
    setTourStep(0)
  }

  function dismissTour() {
    try {
      localStorage.setItem(tourKeyForAccount(accountId), 'true')
    } catch {
      notify('Tour completion could not be saved in this browser.')
    }
    setTourStep(-1)
  }

  useEffect(() => {
    if (tourStep < 0) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissTour()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tourStep])

  useEffect(() => {
    const step = tourStep > 0 ? tourSteps[tourStep - 1] : null
    if (!step) {
      setTourTargetRect(null)
      return
    }

    const selector = step.target.startsWith('.') ? step.target : `[data-tour-target="${step.target}"]`
    const target = document.querySelector<HTMLElement>(selector)
    if (!target) {
      setTourTargetRect(null)
      return
    }

    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const updateRect = () => {
      const rect = target.getBoundingClientRect()
      setTourTargetRect({ top: rect.top - 7, left: rect.left - 7, width: rect.width + 14, height: rect.height + 14 })
    }
    const frame = window.requestAnimationFrame(updateRect)
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [tourStep, page])

  async function enterWorkspace() {
    acceptDisclosure()
    if (!hasAccessToken()) {
      setApiError('Sign in or create an account before entering the private marketplace.')
      document.querySelector('#account')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setApiBusy(true)
    setApiError('')
    try {
      const user = await getCurrentUser()
      setIdentity(user.displayName)
      setAccountUsername(user.username ?? '')
      setAccountId(user.id)
      setWalletAddress(user.walletAddress ?? '')
      const userRole: Record<string, Role> = { prosumer: 'Energy Producer', consumer: 'Energy Consumer', both: 'Producer & Consumer', verifier: 'Verifier', admin: 'Admin', funder: 'Investor', space_owner: 'Project Owner' }
      setRole(userRole[user.role] ?? 'Energy Consumer')
      setAuthMode(user.authMethod)
      setAuthenticatedWorkspace(true)
    } catch (error) {
      clearAccessToken()
      const message = error instanceof Error ? error.message : 'Account authentication is required.'
      setApiError(message)
      notify(message)
    } finally {
      setApiBusy(false)
    }
  }

  async function createListing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const quantity = Number(form.get('quantity'))
    const price = Number(form.get('price'))
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      notify('Enter a valid quantity and price greater than zero.')
      return
    }
    const type = String(form.get('type')) as 'offer' | 'request'
    const { deliveryStart, deliveryEnd } = parseDeliveryWindow(String(form.get('window')))
    try {
      await apiPost('/api/listings', {
        type, quantity, price,
        area: String(form.get('area') || ''),
        source: String(form.get('source') || 'Rooftop solar'),
        deliveryStart, deliveryEnd,
      })
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not publish the listing.')
      return
    }
    setModal(null)
    notify('Listing published to the shared marketplace.')
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const area = Number(form.get('area'))
    const target = Number(form.get('target'))
    const revenueShares = {
      owner: Number(form.get('ownerShare')),
      funder: Number(form.get('funderShare')),
      community: Number(form.get('communityShare')),
    }
    if (!area || area < 10 || area > 100000 || !target || target <= 0) {
      notify('Enter a site area above 10 m² and a positive funding target.')
      return
    }
    if (Object.values(revenueShares).some((share) => !Number.isInteger(share) || share < 0 || share > 100) || Object.values(revenueShares).reduce((sum, share) => sum + share, 0) !== 100) {
      notify('Set whole-number Project Owner, Investor and community allocations that total exactly 100%.')
      return
    }
    try {
      const created = await apiPost<{ data: { id: string; siteId: string } }>('/api/projects', {
        name: String(form.get('name') || 'New community solar site'),
        location: String(form.get('location') || ''),
        siteType: String(form.get('siteType') || 'Residential rooftop'),
        area, target,
        permission: String(form.get('permission') || 'Permission pending review'),
        notes: String(form.get('notes') || ''),
        revenueShares,
        ...(typeof form.get('fundingEstimateId') === 'string' && form.get('fundingEstimateId')
          ? { fundingEstimateId: String(form.get('fundingEstimateId')) }
          : {}),
      })
      if (mockApiEnabled) await apiPost(`/api/solar/sites/${encodeURIComponent(created.data.siteId)}/estimate`, {})
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not submit the site.')
      return
    }
    setModal(null)
    notify('Project created and marked for review.')
  }

  async function estimateProjectFunding(input: ProjectFundingEstimateInput) {
    const response = await apiPost<{ data: ProjectFundingEstimate }>('/api/projects/funding-estimates', {
      ...input,
      consentToAi: input.consentToAi ?? false,
    })
    return response.data
  }

  async function distributeProjectIncome(event: React.FormEvent<HTMLFormElement>, project: Project) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amountUsd = Number(form.get('amountUsd'))
    const source = String(form.get('source') ?? '').trim()
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || source.length < 3) {
      notify('Enter a positive simulated income amount and a source of at least 3 characters.')
      return
    }
    try {
      await apiPost(`/api/projects/${encodeURIComponent(project.id)}/income-distributions`, {
        amountUsd,
        source,
        idempotencyKey: crypto.randomUUID(),
      })
      await refreshFromApi()
      formElement.reset()
      notify('Simulated income allocations recorded. No money was transferred.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not record simulated income allocations.')
    }
  }

  async function reviewSolarProject(project: Project, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt('Add a reason for rejecting this solar site:')?.trim()
      if (!reason) {
        notify('A rejection reason is required.')
        return
      }
    }
    try {
      await apiPost(`/api/projects/${encodeURIComponent(project.id)}/review`, { decision, ...(reason ? { reason } : {}) })
      await refreshFromApi()
      notify(decision === 'approve' ? 'Solar site approved; the Project Owner can publish the fundraising page.' : 'Solar site rejected; the Project Owner was notified.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not review this solar site.')
    }
  }

  async function createMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedListing) return
    const quantity = Number(new FormData(event.currentTarget).get('quantity'))
    if (!quantity || quantity <= 0 || quantity > selectedListing.quantity) {
      notify(`Choose a quantity between 0.1 and ${selectedListing.quantity} kWh.`)
      return
    }
    try {
      await apiPost('/api/trades', { listingId: selectedListing.id, quantity })
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not propose the match.')
      return
    }
    setModal(null)
    setSelectedListing(null)
    setPage('Trades')
    notify('Match reserved in shared records. No energy or money has moved.')
  }

  async function contribute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProject) return
    const amount = Number(new FormData(event.currentTarget).get('amount'))
    const remaining = selectedProject.target - selectedProject.raised
    if (!amount || amount <= 0 || amount > remaining) {
      notify(`Enter an interest amount up to the remaining project goal (${formatUSD(remaining)}).`)
      return
    }
    try {
      await apiPost(`/api/projects/${encodeURIComponent(selectedProject.id)}/contributions`, { amount, idempotencyKey: crypto.randomUUID() })
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not record the contribution.')
      return
    }
    setModal(null)
    setSelectedProject(null)
    notify('Non-cash pledge recorded. No payment was made.')
  }

  async function reviewEvidence(evidence: Evidence, decision: 'Approved' | 'Rejected') {
    const isBuyerReview = evidence.buyerCanReview && evidence.status === 'Pending'
    const isDisputeResolution = evidence.status === 'Disputed' && (role === 'Verifier' || role === 'Admin')
    if (!isBuyerReview && !isDisputeResolution) {
      notify('Only the buyer can approve or dispute delivery evidence. Verifiers can resolve an open dispute.')
      return
    }
    let reason = isDisputeResolution ? undefined : evidence.reason
    if (decision === 'Rejected' && isBuyerReview) {
      if (!window.confirm('Open a dispute for this delivery evidence? Escrow will remain locked until an authorized verifier resolves it.')) return
      reason = 'Buyer disputes the submitted delivery evidence.'
    } else if (decision === 'Rejected' && !reason) {
      const suppliedReason = window.prompt('Add a reason for resolving this dispute in the seller’s favor or refunding the buyer:')
      if (!suppliedReason?.trim()) {
        notify('A reason is required to resolve a dispute.')
        return
      }
      reason = suppliedReason.trim()
    }
    try {
      const chainTransactionHash = chainEnabled
        ? isBuyerReview
          ? decision === 'Approved'
            ? await approveEvidenceOnChain(evidence.trade, evidence.evidenceHash)
            : await raiseDisputeOnChain(evidence.trade, evidence.evidenceHash, reason ?? '')
          : await resolveDisputeOnChain(evidence.trade, decision === 'Approved', reason ?? '')
        : undefined
      await apiPost(`/api/evidence/${encodeURIComponent(evidence.id)}/review`, {
        decision: decision === 'Approved' ? 'approve' : 'reject',
        ...(reason ? { reason } : {}),
        ...(chainTransactionHash ? { chainTransactionHash } : {}),
      })
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not review this evidence.')
      return
    }
    setSelectedEvidence(null)
    setModal(null)
    if (isBuyerReview && decision === 'Rejected') {
      notify('Dispute opened. Escrow stays locked until an authorized verifier resolves it.')
    } else if (decision === 'Approved' && chainPaymentsEnabled) {
      notify('Evidence approved and escrow released to the seller.')
    } else if (isDisputeResolution && decision === 'Rejected') {
      notify(chainPaymentsEnabled
        ? 'Dispute resolved for the buyer and escrow refunded.'
        : 'Dispute resolved; no on-chain payment was configured.')
    } else if (isDisputeResolution) {
      notify(chainEnabled
        ? 'Dispute resolved for the seller and the trade record settled on-chain; this network has no native escrow.'
        : 'Dispute resolved for the seller and trade completed. No funds moved in this deployment.')
    } else if (chainEnabled) {
      notify('Delivery approved and the trade record settled on-chain; this network has no native escrow.')
    } else {
      notify('Trade completed after buyer approval. Both participants can see the completed status; no funds moved.')
    }
  }

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>, trade: Trade) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const quantity = Number(form.get('quantity'))
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > trade.quantity) {
      notify(`Enter a reading greater than zero and no more than ${trade.quantity} kWh.`)
      return
    }
    const intervalStart = new Date(Date.now() - 60 * 60_000).toISOString()
    const intervalEnd = new Date().toISOString()
    const source = String(form.get('source'))
    const evidenceFile = form.get('evidenceFile')
    const file = evidenceFile instanceof File && evidenceFile.size > 0 ? evidenceFile : null
    let evidenceFileSha256: string | undefined
    try {
      evidenceFileSha256 = file ? await sha256File(file) : undefined
    } catch {
      notify('The selected evidence file could not be read. Choose it again and retry.')
      return
    }
    if (aiEvidenceReview && aiEvidenceReview.fileSha256 !== evidenceFileSha256) {
      notify('The file changed after its AI review. Run the review again before submitting.')
      return
    }
    const interval = String(form.get('interval'))
    const reference = evidenceFileSha256 ? `${interval} · SHA-256 ${evidenceFileSha256}` : interval
    try {
      const submission = new FormData()
      submission.append('quantity', String(quantity))
      submission.append('source', source)
      submission.append('intervalStart', intervalStart)
      submission.append('intervalEnd', intervalEnd)
      submission.append('evidenceReference', reference)
      if (file) submission.append('file', file)
      if (evidenceFileSha256) submission.append('evidenceFileSha256', evidenceFileSha256)
      if (aiEvidenceReview) submission.append('aiReviewId', aiEvidenceReview.id)
      await apiUpload(`/api/trades/${encodeURIComponent(trade.id)}/evidence`, submission)
      await refreshFromApi()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not submit evidence.')
      return
    }
    setModal(null)
    setAiEvidenceReview(null)
    setSelectedEvidence(null)
    setSelectedTrade(null)
    notify('Delivery evidence submitted. The buyer must review it; uploading evidence does not send payment.')
  }

  async function downloadEvidenceFile(item: Evidence) {
    try {
      const { blob, fileName } = await apiGetBlob(`/api/evidence/${encodeURIComponent(item.id)}/file`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not download the evidence file.')
    }
  }

  async function checkEvidenceWithAI(trade: Trade, file: File, consent: boolean) {
    if (!consent) {
      notify('Confirm the disclosure before sending this file to OpenRouter.')
      return
    }
    const form = new FormData()
    form.append('file', file)
    form.append('consent', 'true')
    setAiEvidenceLoading(true)
    setAiEvidenceReview(null)
    try {
      const result = await apiUpload<{ data: EvidenceAiReview }>(`/api/trades/${encodeURIComponent(trade.id)}/evidence/ai-review`, form)
      setAiEvidenceReview(result.data)
      notify('AI triage complete. It is advisory; the buyer makes the delivery decision.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'AI evidence review failed.')
    } finally {
      setAiEvidenceLoading(false)
    }
  }

  async function confirmTrade(trade: Trade) {
    if (trade.status !== 'Awaiting confirmation') {
      notify(trade.status === 'Under review'
        ? 'Evidence is ready for delivery review. Use “Review delivery” to approve or dispute it.'
        : 'This trade is not waiting for term confirmation.')
      return
    }
    try {
      await apiPost(`/api/trades/${encodeURIComponent(trade.id)}/confirm`, {})
      await refreshFromApi()
      notify('Your trade confirmation was recorded.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not confirm the trade.')
    }
  }

  async function settleTrade(trade: Trade) {
    const approved = state.evidence.some((item) => item.trade === trade.id && item.status === 'Approved')
    if (!approved) {
      notify('Settlement is locked until evidence is approved.')
      return
    }
    if (trade.status === 'Settled') return
    try {
      const chainTransactionHash = chainEnabled ? await settleTradeOnChain(trade.id) : undefined
      await apiPost(`/api/trades/${encodeURIComponent(trade.id)}/settle`, chainTransactionHash ? { chainTransactionHash } : {})
      await refreshFromApi()
      notify(chainPaymentsEnabled
        ? 'Trade settled and escrowed SepoliaETH released to the seller. Reward points have no cash value.'
        : 'Trade settled in shared records; points have no cash value.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not settle this trade.')
    }
  }

  async function commitTrade(trade: Trade) {
    if (chainPaymentsEnabled && trade.buyerWalletAddress?.toLowerCase() !== walletAddress.toLowerCase()) {
      notify('Only the buyer wallet can approve and fund the escrow transaction.')
      return
    }
    try {
      let quotedPaymentWei: bigint | undefined
      if (chainPaymentsEnabled) {
        const quote = await getTradePaymentQuote(trade)
        quotedPaymentWei = quote.paymentWei
        const totalUsd = trade.quantity * trade.price
        const approved = window.confirm(
          `Escrow this trade's USD ${totalUsd.toFixed(4)} equivalent?\n\n` +
          `Payment: ${quote.paymentEth} SepoliaETH\n` +
          `ETH/USD quote: $${quote.ethUsdPrice.toFixed(2)}\n\n` +
          'MetaMask will ask you to approve the transaction. The contract holds the ETH until the buyer approves delivery or an authorized verifier resolves a dispute. This is testnet ETH with no real-world value.',
        )
        if (!approved) return
      }
      const transactionHash = await commitTradeOnChain(trade, quotedPaymentWei)
      await apiPost(`/api/trades/${encodeURIComponent(trade.id)}/commitment`, { transactionHash })
      await refreshFromApi()
      notify(chainPaymentsEnabled
        ? 'Trade terms were recorded and SepoliaETH escrowed by the contract.'
        : 'Trade terms were committed to the configured EVM contract.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not commit this trade on-chain.')
    }
  }

  async function updateListing(listing: Listing, action: 'pause' | 'resume' | 'cancel') {
    try {
      await apiPatch(`/api/listings/${encodeURIComponent(listing.id)}`, { action })
      await refreshFromApi()
      notify(`Listing ${action === 'cancel' ? 'cancelled' : `${action}d`}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the listing.')
    }
  }

  function copyText(value: string) {
    if (!navigator.clipboard) {
      notify('Clipboard access is unavailable in this browser.')
      return
    }
    navigator.clipboard.writeText(value).then(() => notify('Copied to clipboard.')).catch(() => notify('Could not copy. Check browser clipboard permissions.'))
  }

  const pageTitle = page === 'Overview' ? `Good morning, ${identity.split(' ')[0] || 'neighbor'}` : page
  const pageDescription: Record<Page, string> = {
    Overview: 'Here’s what’s happening across your energy network.',
    'Energy market': 'Find clean energy nearby and discover your next match.',
    'My offers': 'Manage the renewable energy you’ve made available.',
    'My requests': 'Track the energy you need from your community.',
    Trades: 'Follow every match from proposal to evidence and settlement.',
    Evidence: 'Review meter readings and keep every clean-energy claim accountable.',
    Rewards: 'Your participation, recognized. Points have no cash value.',
    'Solar projects': 'Discover local sites bringing community solar to life.',
    Activity: 'A transparent record of actions across your account.',
    Settings: 'Manage your profile, preferences, and data.',
  }
  const currentTourStep = tourStep > 0 ? tourSteps[tourStep - 1] : null
  const tourCardPosition = tourTargetRect ? (() => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight
    const cardWidth = Math.min(380, viewportWidth - 32)
    const cardHeight = 290
    const left = tourTargetRect.left + tourTargetRect.width / 2 > viewportWidth / 2
      ? 16
      : viewportWidth - cardWidth - 16
    const belowTop = tourTargetRect.top + tourTargetRect.height + 16
    const top = tourTargetRect.top + tourTargetRect.height / 2 > viewportHeight / 2
      ? 16
      : Math.min(belowTop, viewportHeight - cardHeight - 16)
    return { left, top }
  })() : undefined

  if (!authenticatedWorkspace) return <>
    <Landing
      onExplore={() => { void enterWorkspace() }}
      onWallet={() => { void connectWallet() }}
      onPasswordAuth={(input) => { void connectPassword(input) }}
      displayName={walletDisplayName}
      setDisplayName={setWalletDisplayName}
      walletRole={walletRole}
      setWalletRole={setWalletRole}
      walletProviders={walletProviders}
      selectedWalletId={selectedWalletId}
      setSelectedWalletId={(id) => {
        try {
          selectEvmWallet(id)
          setSelectedWalletId(id)
        } catch (error) {
          setApiError(error instanceof Error ? error.message : 'Could not select this wallet.')
        }
      }}
      onRefreshWallets={() => { void refreshWalletProviders() }}
      theme={theme}
      busy={apiBusy}
      error={apiError}
      notice={landingNotice}
    />
    {showDisclosure && <Disclosure onAccept={acceptDisclosure} />}
  </>

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Logo /><button className="icon-button close-menu" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
        <div className="demo-chip"><span className="pulse-dot" /> CONNECTED WORKSPACE <span className="workspace-state-dot" /></div>
        <div className="workspace-select"><span className="workspace-avatar">BL</span><span><b>My energy space</b><small>Global energy exchange</small></span><ChevronDown size={15} /></div>
        {['Workspace', 'Trading', 'Community solar', 'Manage'].map((group) => (
          <nav className="nav-group" key={group} aria-label={group}>
            <span className="nav-label">{group}</span>
            {navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
              <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setMenuOpen(false); setQuery('') }}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                {label === 'Evidence' && pendingEvidence.length > 0 && <span className="nav-count">{pendingEvidence.length}</span>}
              </button>
            ))}
          </nav>
        ))}
        <div className="sidebar-bottom">
          <div className="network-card"><div className="network-icon"><Bolt size={17} /></div><div><span>{walletChainId === null ? 'Wallet network' : evmNetworkName(walletChainId)}</span><small>{walletChainId === null ? 'Connect an EVM wallet' : `Chain ID ${walletChainId}${configuredChainId === walletChainId ? ' · contract configured' : ' · no contract configured'}`}</small></div><span className={`network-live ${walletChainId !== null && configuredChainId === walletChainId ? '' : 'offline'}`} /></div>
          <button className="profile-card" onClick={() => { setPage('Settings'); setMenuOpen(false) }}>
            <span className="avatar">{identity.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BL'}</span><span><b>{identity || 'Bright Ledger'}</b><small>{role} · {authMode === 'wallet' ? 'Wallet account' : 'Password account'}</small></span><MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Bright Ledger</span><ChevronRight size={14} /><b>{page}</b></div>
          <div className="topbar-actions">
            <label className="top-search"><Search size={16} /><input aria-label="Search the workspace" placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
            <button className="icon-button theme-control" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Sun size={18} /> : <span className="moon-icon">◐</span>}</button>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ''}`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{unreadNotifications.length > 0 && <i />}</button>
              {notificationsOpen && <div className="notification-popover">
                <div className="popover-heading"><span><b>Notifications</b><small>{unreadNotifications.length ? `${unreadNotifications.length} unread` : 'All caught up'}</small></span><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>
                {notifications.length === 0
                  ? <div className="notification-empty"><Bell size={18} /><span>No account updates yet.</span></div>
                  : <div className="notification-list">{notifications.map((item) => {
                    const unread = !item.readAt
                    return <button className={`notification-item ${unread ? 'unread' : ''}`} key={item.id} onClick={() => {
                      markNotificationRead(item.id)
                      setPage(item.page)
                      setNotificationsOpen(false)
                    }}><span className={`notification-mark ${item.page === 'Evidence' ? 'evidence-mark' : ''}`}><Bell size={14} /></span><span><b>{item.title}</b><small>{item.detail}</small></span>{unread && <i aria-label="Unread" />}</button>
                  })}</div>}
                <div className="notification-footer"><button className="text-link" disabled={unreadNotifications.length === 0} onClick={markAllNotificationsRead}>Mark all as read</button><span>Updates from your trade and evidence records</span></div>
              </div>}
            </div>
            <div className="wallet-menu-wrap">
              <button className="wallet-button" aria-expanded={accountMenuOpen} onClick={() => { setAccountMenuOpen((open) => !open); setNotificationsOpen(false) }}>
                <Wallet size={16} /><span>{walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : identity}</span><ChevronDown size={14} />
              </button>
              {accountMenuOpen && <div className="account-popover">
                {authMode === 'wallet' ? <>
                  <div className="account-popover-heading"><span className="avatar">{identity.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'W3'}</span><span><b>{identity}</b><small>{accountUsername ? `@${accountUsername} · ` : ''}{role} · wallet profile</small></span></div>
                  <div className="account-address"><span>Connected address</span><code title={walletAddress}>{walletAddress}</code><button className="text-link" onClick={() => { void copyText(walletAddress) }}><Copy size={13} /> Copy address</button></div>
                  <div className="account-network"><span>{walletChainId === null ? 'Network unavailable' : evmNetworkName(walletChainId)}</span><small>{walletChainId === null ? 'Check your wallet connection' : `Chain ID ${walletChainId}${configuredChainId === walletChainId ? ' · contract ready' : ' · contract unavailable'}`}</small></div>
                  {explorerAddressUrl(walletChainId, walletAddress) && <a className="account-menu-link" href={explorerAddressUrl(walletChainId, walletAddress)!} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View address on explorer</a>}
                  <button className="account-menu-link" onClick={() => { setPage('Settings'); setAccountMenuOpen(false) }}><Settings size={14} /> Profile & wallet settings</button>
                  <button className="account-menu-link" onClick={signOut}><Wallet size={14} /> Sign out of Bright Ledger</button>
                  <button className="account-menu-link danger-link" onClick={() => { setAccountRemovalOpen(true); setAccountMenuOpen(false) }}><X size={14} /> Remove account profile</button>
                </> : authMode === 'password' ? <>
                  <div className="account-popover-heading"><span className="avatar">{identity.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BL'}</span><span><b>{identity}</b><small>@{accountUsername} · {role} · password account</small></span></div>
                  <button className="account-menu-link" onClick={() => { setPage('Settings'); setAccountMenuOpen(false) }}><Settings size={14} /> Account & wallet settings</button>
                  <button className="account-menu-link" onClick={signOut}><Wallet size={14} /> Sign out of Bright Ledger</button>
                </> : null}
              </div>}
            </div>
          </div>
        </header>

        <div className="content-area">
          {!apiConnected && <div className="storage-warning"><CircleHelp size={15} /> {apiBusy ? 'Connecting to the Bright Ledger API…' : apiError || 'Backend connection unavailable. Shared activity requires the API connection.'}</div>}
          {!walletAddress && <div className="helper-note"><CircleHelp size={15} /><span>This account has no verified EVM wallet. Listings, trades, and wallet-signed blockchain actions are unavailable until you link one.</span><button className="text-link" onClick={() => setPage('Settings')}>Link in Settings <ArrowRight size={13} /></button></div>}
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR ENERGY, YOUR COMMUNITY</div><h1>{pageTitle}<span className="greeting-sun">✳</span></h1><p>{pageDescription[page]}</p></div>
            <div className="heading-actions">
              <div className="role-switch"><span>Marketplace role</span><b>{role}</b></div>
              {(page === 'Overview' || page === 'My offers' || page === 'My requests') && <button className="button button-primary" data-tour-target={page === 'My offers' ? 'offer-form' : page === 'My requests' ? 'request-form' : undefined} onClick={() => setModal('listing')}><Plus size={17} /> Create listing</button>}
              {page === 'Solar projects' && <button className="button button-primary" onClick={() => setModal('project')}><Plus size={17} /> Create fundraiser</button>}
              {page === 'Energy market' && <button className="button button-primary" onClick={() => setModal('listing')}><Plus size={17} /> Create listing</button>}
            </div>
          </div>

          {page === 'Overview' && <Overview state={state} setPage={setPage} onCreate={() => setModal('listing')} openOffers={openOffers.length} offered={totalOffered} settled={settledEnergy} points={state.points} />}
          {page === 'Energy market' && <Market listings={state.listings.filter((item) => item.status === 'Open')} marketTab={marketTab} setMarketTab={setMarketTab} onMatch={(listing) => { setSelectedListing(listing); setModal('match') }} query={query} setQuery={setQuery} onInfo={() => notify('Matching checks quantity, price limits, overlapping delivery windows and service area.')} />}
          {page === 'My offers' && <ListingPage title="Your active offers" listings={state.listings.filter((item) => item.type === 'offer' && item.isMine)} onCreate={() => setModal('listing')} onAction={updateListing} />}
          {page === 'My requests' && <ListingPage title="Your energy requests" listings={state.listings.filter((item) => item.type === 'request' && item.isMine)} onCreate={() => setModal('listing')} onAction={updateListing} />}
          {page === 'Trades' && <Trades trades={filteredTrades} statusFilter={statusFilter} setStatusFilter={setStatusFilter} state={state} role={role} walletAddress={walletAddress} chainPaymentsEnabled={chainPaymentsEnabled} onSettle={settleTrade} onConfirm={confirmTrade} onCommit={commitTrade} onEvidence={(trade) => { setAiEvidenceReview(null); setSelectedTrade(trade); setSelectedEvidence(null); setModal('evidence') }} onReviewEvidence={(item) => { setAiEvidenceReview(null); setSelectedEvidence(item); setSelectedTrade(null); setModal('evidence') }} onCopy={copyText} />}
          {page === 'Evidence' && <EvidencePage evidence={state.evidence} role={role} onReview={(item) => { setAiEvidenceReview(null); setSelectedEvidence(item); setModal('evidence') }} onSelect={(item) => { setAiEvidenceReview(null); setSelectedEvidence(item); setModal('evidence') }} onDownload={(item) => { void downloadEvidenceFile(item) }} />}
          {page === 'Rewards' && <Rewards state={state} />}
          {page === 'Solar projects' && <Projects projects={filteredProjects} contributions={state.contributions} filter={projectFilter} setFilter={setProjectFilter} onFund={(project) => { setSelectedProject(project); setModal('fund') }} onCreate={() => setModal('project')} onDistributeIncome={distributeProjectIncome} onOpen={setSolarWorkspaceId} workspaceId={solarWorkspaceId} onCloseWorkspace={() => setSolarWorkspaceId('')} role={role} identity={identity} mockApiEnabled={mockApiEnabled} onNotify={notify} onRefresh={refreshFromApi} />}
          {page === 'Solar projects' && ['Verifier', 'Admin'].includes(role) && <SolarProjectReviewQueue projects={state.projects.filter((project) => project.status === 'Review')} onReview={(project, decision) => { void reviewSolarProject(project, decision) }} />}
          {page === 'Solar projects' && <SolarEstimateTransparency projects={filteredProjects} />}
          {page === 'Activity' && <ActivityPage activity={state.activity} onCopy={copyText} />}
          {page === 'Settings' && <SettingsPage role={role} username={accountUsername} authMode={authMode === 'wallet' ? 'wallet' : 'password'} walletConnected={Boolean(walletAddress)} walletAddress={walletAddress} walletChainId={walletChainId} configuredChainId={configuredChainId} contractAddress={contractAddress} walletProviders={walletProviders} selectedWalletId={selectedWalletId} apiBusy={apiBusy} onChangeRole={(value) => { void changeRole(value) }} setSelectedWalletId={(id) => {
            try {
              selectEvmWallet(id)
              setSelectedWalletId(id)
            } catch (error) {
              setApiError(error instanceof Error ? error.message : 'Could not select this wallet.')
            }
          }} onRefreshWallets={refreshWalletProviders} onLinkWallet={() => { void linkWallet() }} theme={theme} setTheme={setTheme} onCopy={(value) => { void copyText(value) }} onSignOut={signOut} onRequestRemove={() => setAccountRemovalOpen(true)} onStartTour={startTour} onReset={() => { void refreshFromApi().then(() => notify('Refreshed shared records from the server.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not refresh server records.')) }} />}
        </div>
        <footer className="page-footer"><span>© 2026 Bright Ledger</span><span><span className="footer-dot" /> Shared records</span><button onClick={() => notify('Energy delivery, payments, and environmental claims are not verified by this software.')}>Platform limitations <ExternalLink size={13} /></button></footer>
      </main>

      {modal && <Modal
        kind={modal}
        onClose={() => { setModal(null); setAiEvidenceReview(null); setAiEvidenceLoading(false); setSelectedListing(null); setSelectedProject(null); setSelectedEvidence(null); setSelectedTrade(null) }}
        onListing={createListing}
        onProject={createProject}
        onEstimateProject={estimateProjectFunding}
        onMatch={createMatch}
        onFund={contribute}
        onEvidenceSubmit={submitEvidence}
        onEvidenceAIReview={(file, consent) => { if (selectedTrade) void checkEvidenceWithAI(selectedTrade, file, consent) }}
        onEvidenceFileChange={() => setAiEvidenceReview(null)}
        aiEvidenceReview={aiEvidenceReview}
        aiEvidenceLoading={aiEvidenceLoading}
        listing={selectedListing}
        project={selectedProject}
        evidence={selectedEvidence}
        role={role}
        chainPaymentsEnabled={chainPaymentsEnabled}
        onReview={reviewEvidence}
        onSettle={settleTrade}
        trade={selectedEvidence ? state.trades.find((item) => item.id === selectedEvidence.trade) : selectedTrade ?? undefined}
      />}
      {tourStep === 0 && <div className="tour-backdrop"><section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title"><span className="section-kicker">FIRST VISIT · GUIDED TOUR</span><h2 id="tour-title">Welcome to Bright Ledger</h2><p>Take a guided walkthrough of energy offers and requests, listing details, trade steps, evidence, and community solar. We’ll highlight each part of the workspace and explain what information belongs there.</p><div className="tour-actions"><button className="button button-outline" onClick={dismissTour}>Not now</button><button autoFocus className="button button-primary" onClick={advanceTour}>Start tour <ArrowRight size={14} /></button></div></section></div>}
      {tourStep > 0 && currentTourStep && <>{tourTargetRect && <div className="tour-spotlight-layer" aria-hidden="true"><div className="tour-spotlight" style={{ top: tourTargetRect.top, left: tourTargetRect.left, width: tourTargetRect.width, height: tourTargetRect.height }} /></div>}<section className="tour-card tour-guide" style={tourCardPosition} role="dialog" aria-modal="true" aria-labelledby="tour-title"><div className="tour-progress"><span>GUIDED TOUR</span><span>{tourStep} OF {tourSteps.length}</span></div><div className="tour-progress-track"><i style={{ width: `${tourStep / tourSteps.length * 100}%` }} /></div><h2 id="tour-title">{currentTourStep.title}</h2><p>{currentTourStep.description}</p><div className="tour-actions"><button className="tour-skip" onClick={dismissTour}>Skip tour</button><button className="button button-outline" onClick={previousTour}>Back</button><button autoFocus className="button button-primary" onClick={advanceTour}>{tourStep === tourSteps.length ? 'Finish' : 'Next'} <ArrowRight size={14} /></button></div></section></>}
      {accountRemovalOpen && <div className="confirm-backdrop"><section className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="remove-account-title"><span className="settings-icon danger-settings"><ShieldCheck size={18} /></span><span className="section-kicker">WALLET PROFILE</span><h2 id="remove-account-title">Remove this account?</h2><p>Your wallet will ask you to sign a one-time removal request. Bright Ledger will unlink this wallet and anonymize your profile; existing marketplace and audit records will remain, attributed to “Removed account.” This does not disconnect the wallet from other apps.</p><div className="confirm-actions"><button className="button button-outline" disabled={apiBusy} onClick={() => setAccountRemovalOpen(false)}>Cancel</button><button className="button button-danger-outline" disabled={apiBusy} onClick={() => { void removeAccount() }}>{apiBusy ? 'Waiting for wallet…' : 'Sign & remove account'}</button></div></section></div>}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

function Overview({ state, setPage, onCreate, openOffers, offered, settled, points }: { state: AppState; setPage: (page: Page) => void; onCreate: () => void; openOffers: number; offered: number; settled: number; points: number }) {
  const approved = state.evidence.filter((item) => item.status === 'Approved').reduce((sum, item) => sum + item.quantity, 0)
  const activityBars = [
    { label: 'Energy in open offers', value: state.listings.filter((item) => item.type === 'offer' && item.status === 'Open').reduce((sum, item) => sum + item.quantity, 0), color: 'solar' },
    { label: 'Energy in settled records', value: settled, color: 'traded' },
    { label: 'Energy with approved evidence', value: approved, color: 'verified' },
  ]
  const activityMaximum = Math.max(1, ...activityBars.map((item) => item.value))
  const metrics = [
    { label: 'Energy listed', value: `${offered.toFixed(1)} kWh`, change: `${openOffers} open offers`, note: 'shared listing records', icon: Sun, color: 'gold' },
    { label: 'Settled records', value: `${settled.toFixed(1)} kWh`, change: `${state.trades.filter((item) => item.status === 'Settled').length} trades`, note: 'recorded in the system', icon: Zap, color: 'green' },
    { label: 'Active trades', value: String(state.trades.filter((item) => item.status !== 'Settled').length).padStart(2, '0'), change: `${openOffers} offers live`, note: 'in your microgrid', icon: Activity, color: 'blue' },
    { label: 'Community points', value: new Intl.NumberFormat('en-US').format(points), change: 'Non-cash rewards', note: 'no cash value', icon: Leaf, color: 'purple' },
  ]
  return <div className="dashboard-content">
    <section className="metric-grid" data-tour-target="overview">{metrics.map(({ label, value, change, note, icon: Icon, color }) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-foot"><span className="metric-change"><TrendingUp size={13} />{change}</span><span>{note}</span></div><div className={`metric-sparkline ${color}`}><svg viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23 C10 21 12 12 21 15 S34 23 44 14 58 17 68 9 81 15 91 7 106 12 120 2" /></svg></div></article>)}</section>

    <section className="dashboard-grid">
      <article className="panel activity-panel">
        <div className="panel-heading"><div><span className="section-kicker">COMMUNITY SNAPSHOT</span><h2>Energy activity</h2><p>Quantities from current marketplace and trade records</p></div><button className="text-link" onClick={() => setPage('Activity')}>View activity <ArrowRight size={14} /></button></div>
        <div className="activity-bars">{activityBars.map((item) => <div className="activity-bar-row" key={item.label}><div><span>{item.label}</span><b>{item.value.toFixed(1)} kWh</b></div><div className="activity-bar-track"><i className={item.color} style={{ width: `${Math.max(item.value > 0 ? 4 : 0, item.value / activityMaximum * 100)}%` }} /></div></div>)}</div>
        <div className="chart-caption"><span>Approved evidence is an application status, not independent meter verification.</span><button className="text-link" onClick={() => setPage('Evidence')}>Review evidence <ArrowRight size={14} /></button></div>
      </article>

      <article className="panel action-panel">
        <div className="panel-heading"><div><span className="section-kicker">STAY IN THE LOOP</span><h2>Needs your attention</h2></div><span className="attention-count">{state.evidence.filter((item) => item.status === 'Pending').length + state.trades.filter((item) => item.status === 'Evidence needed').length}</span></div>
        <div className="attention-list">
          {state.trades.filter((item) => item.status === 'Evidence needed' || item.status === 'Awaiting confirmation').slice(0, 2).map((trade) => <button className="attention-item" key={trade.id} onClick={() => setPage('Trades')}><span className="attention-icon amber"><Clock3 size={16} /></span><span><b>{trade.status === 'Evidence needed' ? 'Delivery evidence needed' : 'Confirm your match'}</b><small>{trade.id} · {trade.quantity} kWh</small></span><ChevronRight size={16} /></button>)}
          {state.evidence.filter((item) => item.status === 'Pending').slice(0, 1).map((item) => <button className="attention-item" key={item.id} onClick={() => setPage('Evidence')}><span className="attention-icon green"><ShieldCheck size={16} /></span><span><b>Evidence awaiting review</b><small>{item.trade} · {item.quantity} kWh</small></span><ChevronRight size={16} /></button>)}
          {state.trades.filter((item) => item.status === 'Evidence needed' || item.status === 'Awaiting confirmation').length === 0 && state.evidence.filter((item) => item.status === 'Pending').length === 0 && <div className="all-clear"><CheckCircle2 size={20} /><span>All caught up. Nothing needs your attention.</span></div>}
        </div>
        <button className="attention-footer" onClick={() => setPage('Trades')}>View all activity <ArrowRight size={14} /></button>
      </article>
    </section>

    <section className="lower-grid">
      <article className="panel trades-panel">
        <div className="panel-heading"><div><span className="section-kicker">YOUR NETWORK</span><h2>Recent trades</h2></div><button className="text-link" onClick={() => setPage('Trades')}>All trades <ArrowRight size={14} /></button></div>
        <div className="trade-table-wrap"><table className="trade-table"><thead><tr><th>Trade</th><th>Energy</th><th>Counterparty</th><th>Status</th><th></th></tr></thead><tbody>{state.trades.slice(0, 3).map((trade) => <tr key={trade.id}><td><b>{trade.id}</b><small>{trade.time}</small></td><td><b>{trade.quantity} kWh</b><small>${trade.price.toFixed(2)} / kWh</small></td><td><span className="table-avatar">{trade.seller.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>{trade.seller}</td><td><Status status={trade.status} /></td><td><button className="icon-button tiny" aria-label={`Open ${trade.id}`} onClick={() => setPage('Trades')}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div>
        <div className="mobile-trade-cards">{state.trades.slice(0, 3).map((trade) => <button className="mobile-trade-card" key={trade.id} onClick={() => setPage('Trades')}><span><b>{trade.id}</b><small>{trade.quantity} kWh · {trade.seller}</small></span><Status status={trade.status} /></button>)}</div>
      </article>
      <article className="impact-card">
        <div className="impact-top"><div><span className="section-kicker">A BRIGHTER TOMORROW</span><h2>Small actions,<br />real momentum.</h2></div><div className="impact-sun"><Sun size={28} /></div></div>
        <p><strong>{approved.toFixed(1)} kWh</strong> currently has an approved evidence record in this system.</p>
        <div className="impact-divider" />
        <div className="impact-stat"><span><ShieldCheck size={15} /> Approved evidence records</span><b>{state.evidence.filter((item) => item.status === 'Approved').length}</b></div>
        <small className="impact-disclaimer">This status does not prove physical delivery or establish avoided emissions.</small>
        <button className="impact-link" onClick={() => setPage('Rewards')}>Explore your impact <ArrowRight size={14} /></button>
      </article>
    </section>

    <section className="market-strip">
      <div className="market-strip-head"><div><span className="section-kicker">ENERGY AROUND YOU</span><h2>Fresh from the market</h2></div><button className="text-link" onClick={() => setPage('Energy market')}>Explore market <ArrowRight size={14} /></button></div>
      <div className="offer-cards">{state.listings.filter((item) => item.type === 'offer' && item.status === 'Open').slice(0, 3).map((offer) => <article className="offer-card" key={offer.id}><div className="offer-avatar">{offer.owner.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div className="offer-copy"><b>{offer.owner}</b><span><span className="mini-dot green" /> {offer.area} · {offer.source}</span><small>{offer.quantity} kWh available · {offer.window}</small></div><div className="offer-price"><b>${offer.price.toFixed(2)}</b><small>per kWh</small></div></article>)}</div>
    </section>

    <section className="overview-bottom"><div className="live-note"><span className="pulse-dot" /><span><b>Community marketplace</b><small>{state.activity.length} recent account events</small></span></div><button className="button button-secondary" onClick={onCreate}><Plus size={16} /> Create a listing</button></section>
  </div>
}

function Landing({ onExplore, onWallet, onPasswordAuth, displayName, setDisplayName, walletRole, setWalletRole, walletProviders, selectedWalletId, setSelectedWalletId, onRefreshWallets, theme, busy, error, notice }: {
  onExplore: () => void
  onWallet: () => void
  onPasswordAuth: (input: { mode: 'register' | 'login'; username: string; password: string; displayName?: string; role?: 'prosumer' | 'consumer' | 'both' | 'funder' }) => void
  displayName: string
  setDisplayName: (value: string) => void
  walletRole: 'prosumer' | 'consumer' | 'both' | 'funder'
  setWalletRole: (value: 'prosumer' | 'consumer' | 'both' | 'funder') => void
  walletProviders: EvmWalletInfo[]
  selectedWalletId: string
  setSelectedWalletId: (id: string) => void
  onRefreshWallets: () => void
  theme: 'light' | 'dark'
  busy: boolean
  error: string
  notice: string
}) {
  const modelFrame = useRef<HTMLIFrameElement>(null)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelFailed, setModelFailed] = useState(false)
  const [authTab, setAuthTab] = useState<'password' | 'wallet'>('password')
  const [passwordMode, setPasswordMode] = useState<'register' | 'login'>('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => {
    modelFrame.current?.contentWindow?.postMessage({ type: 'bl-theme', theme }, '*')
  }, [theme])
  useEffect(() => {
    const timeout = window.setTimeout(() => setModelFailed(true), 12000)
    const handleModelMessage = (event: MessageEvent) => {
      if (event.source !== modelFrame.current?.contentWindow || typeof event.data !== 'object' || event.data === null) return
      if (event.data.type === 'bl-model-ready') {
        window.clearTimeout(timeout)
        setModelLoaded(true)
        setModelFailed(false)
      } else if (event.data.type === 'bl-model-error') {
        window.clearTimeout(timeout)
        setModelFailed(true)
      }
    }
    window.addEventListener('message', handleModelMessage)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('message', handleModelMessage)
    }
  }, [])

  return <main className="landing-shell">
    <header className="landing-nav"><a className="landing-brand" href="#home" aria-label="Bright Ledger home"><Logo /></a><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#impact">Community impact</a></nav><a className="landing-nav-link" href="#account"><Wallet size={15} /> Create account</a></header>
    <section className="landing-hero" id="home"><div className="landing-copy"><span className="landing-kicker"><span className="pulse-dot" /> LOCAL ENERGY, SHARED BRIGHTER</span><h1 aria-label="Make clean energy count for everyone"><span className="landing-headline-line"><span>Make</span><span className="rotating-word" aria-hidden="true"><span className="rotating-word-track"><span>clean energy</span><span>solar power</span><span>shared energy</span><span>local power</span><span>clean energy</span></span></span></span><br />count for <em>everyone.</em></h1><p>Discover renewable energy from your neighbors, coordinate local trades, and see every step—from match to evidence.</p><div className="landing-actions"><button className="button button-primary" onClick={onExplore} disabled={busy}>Explore the marketplace <ArrowRight size={16} /></button><a href="#how-it-works">See how it works <ChevronRight size={15} /></a></div><div className="landing-trust"><span><CheckCircle2 size={15} /> Transparent by design</span><i /><span><ShieldCheck size={15} /> Evidence-led</span><i /><span><Leaf size={15} /> Community-powered</span></div></div>
      <div className={`landing-visual ${modelLoaded ? 'model-loaded' : ''}`}>
        {!modelLoaded && <div className="model-skeleton" role="status" aria-live="polite">
          <div className="model-skeleton-sun" />
          <div className="model-skeleton-house skeleton-house-one"><i /><span /><b /></div>
          <div className="model-skeleton-house skeleton-house-two"><i /><span /><b /></div>
          <div className="model-skeleton-panel" />
          <span>{modelFailed ? '3D preview unavailable' : 'Loading interactive solar neighborhood…'}</span>
        </div>}
        <iframe ref={modelFrame} title="Interactive 3D community solar neighborhood" src="/models/community-solar.html" loading="eager" sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={(event) => { event.currentTarget.contentWindow?.postMessage({ type: 'bl-theme', theme }, '*') }} />
        <span className="landing-label">Illustrative solar neighborhood · drag to explore</span>
      </div>
      <div className="landing-scroll">SCROLL TO EXPLORE <span /></div>
    </section>
    <section className="landing-how" id="how-it-works">
      <div className="landing-section-heading">
        <span className="section-kicker">HOW THE EXCHANGE WORKS</span>
        <h2>A clearer path from<br />local generation to <em>shared value.</em></h2>
        <p>Rooftop solar is growing, but neighbors often lack a simple way to discover local supply, agree on terms, and track what happened. Bright Ledger organizes that coordination in one shared workflow.</p>
        <div className="research-callout"><span>Research context</span><p>Microgrid market research highlights the importance of clear market roles, local coordination, and transparent rules—not just a blockchain ledger.</p><a href="https://doi.org/10.1016/j.apenergy.2017.06.054" target="_blank" rel="noreferrer">Mengelkamp et al., Applied Energy (2018) <ExternalLink size={12} /></a></div>
      </div>
      <div className="landing-step-grid">
        <article><span className="step-number">01</span><span className="landing-step-icon"><Sun size={19} /></span><h3>Publish a real-world offer</h3><p>A generator records energy quantity, seller-set USD/kWh price, location, renewable source, and delivery window. Buyers can instead post a request with a maximum price.</p></article>
        <article><span className="step-number">02</span><span className="landing-step-icon"><Activity size={19} /></span><h3>Agree before matching</h3><p>Participants review the location and terms, then propose a quantity. A match reserves a marketplace record; it is not a power-flow schedule or a payment.</p></article>
        <article><span className="step-number">03</span><span className="landing-step-icon"><Zap size={19} /></span><h3>Track trade milestones</h3><p>Confirmation, evidence, review, and settlement each have a distinct status. Optional EVM transactions can anchor supported records on the configured network.</p></article>
        <article><span className="step-number">04</span><span className="landing-step-icon"><ShieldCheck size={19} /></span><h3>Keep evidence in context</h3><p>Meter readings and attachments can be submitted for review. AI is advisory; an approval in this app is not independent meter validation or proof of grid delivery.</p></article>
      </div>
    </section>
    <section className="landing-impact" id="impact">
      <div className="impact-page-intro"><span className="section-kicker">COMMUNITY IMPACT · POTENTIAL, NOT PROMISE</span><h2>Climate progress needs<br />local action and <em>credible evidence.</em></h2><p>Electricity generation is a major source of greenhouse-gas emissions, while rooftop and community renewables can add distributed clean supply. A marketplace can help people coordinate—but climate benefit depends on new generation, local grid conditions, and what energy it actually displaces.</p></div>
      <div className="impact-research-grid">
        <article><span className="impact-research-icon"><Leaf size={18} /></span><h3>The challenge</h3><p>Clean-energy assets are unevenly accessible. People may have suitable roofs, capital, or flexible demand without a clear way to find partners and understand project status.</p></article>
        <article><span className="impact-research-icon"><Activity size={18} /></span><h3>A coordination layer</h3><p>Bright Ledger makes offers, requests, agreed terms, project submissions, and evidence status easier to inspect in one workflow. It does not replace utilities, grid operators, regulators, or physical metering.</p></article>
        <article><span className="impact-research-icon"><TrendingUp size={18} /></span><h3>Designed to scale responsibly</h3><p>Start with a community or service area; connect through APIs and utility-approved market rules where available. Keep personal data off-chain, and use a blockchain only when shared auditability justifies its costs.</p></article>
        <article><span className="impact-research-icon"><ClipboardCheck size={18} /></span><h3>Measure what matters</h3><p>Track new renewable capacity, metered kWh delivered, participation and affordability, and evidence quality. Estimate emissions only with a stated grid emissions factor, time period, baseline, and independently checked data.</p></article>
      </div>
      <div className="impact-evidence">
        <div><span className="section-kicker">WHAT THE RESEARCH SAYS</span><h3>Local markets need more than a ledger</h3><p>Peer-reviewed microgrid market work examines participant incentives and operating rules in a real-world pilot context. Bright Ledger borrows the coordination idea, while treating settlement, grid operation, and environmental claims as separate responsibilities.</p></div>
        <a href="https://doi.org/10.1016/j.apenergy.2017.06.054" target="_blank" rel="noreferrer"><b>Designing microgrid energy markets</b><span>Esther Mengelkamp et al. · Applied Energy · 2018</span><small>DOI: 10.1016/j.apenergy.2017.06.054 <ExternalLink size={12} /></small></a>
        <a href="https://doi.org/10.5220/0008915400400049" target="_blank" rel="noreferrer"><b>Peer-to-peer Energy Trading for Smart Energy Communities</b><span>Roman Denysiuk et al. · ICAART · 2020</span><small>DOI: 10.5220/0008915400400049 <ExternalLink size={12} /></small></a>
        <a href="https://www.ipcc.ch/report/ar6/wg3/" target="_blank" rel="noreferrer"><b>Climate mitigation pathways and energy systems</b><span>IPCC Sixth Assessment Report · Working Group III · 2022</span><small>Mitigation evidence and context <ExternalLink size={12} /></small></a>
      </div>
      <p className="impact-boundary"><ShieldCheck size={15} /> Bright Ledger currently records marketplace activity; this software does not deliver electricity, clear trades with a utility, verify meter data independently, or calculate avoided emissions. Any climate impact must be measured outside the platform and reported with its method and limitations.</p>
      <button className="button button-secondary" onClick={onExplore}>Explore the marketplace <ArrowRight size={15} /></button>
    </section>
    <section className="landing-account" id="account"><div><span className="section-kicker">JOIN YOUR LOCAL NETWORK</span><h2>Choose how to sign in.<br /><em>Stay in control.</em></h2><p>Create an account with a username and password, then link an EVM wallet later in Settings. Or sign in directly with a browser wallet. Wallet-dependent marketplace and on-chain actions require a verified linked wallet.</p>{error && <div className="landing-error" role="alert">{error}</div>}{notice && <div className="landing-notice" role="status">{notice}</div>}</div><div className="wallet-signup">
      <div className="segmented-tabs" role="tablist" aria-label="Account sign-in method">
        <button type="button" role="tab" aria-selected={authTab === 'password'} className={authTab === 'password' ? 'selected' : ''} onClick={() => setAuthTab('password')}>Username & password</button>
        <button type="button" role="tab" aria-selected={authTab === 'wallet'} className={authTab === 'wallet' ? 'selected' : ''} onClick={() => setAuthTab('wallet')}>Browser wallet</button>
      </div>
      {authTab === 'password' ? <form onSubmit={(event) => {
        event.preventDefault()
        onPasswordAuth({
          mode: passwordMode,
          username,
          password,
          ...(passwordMode === 'register' ? { displayName: displayName.trim(), role: walletRole } : {}),
        })
      }}>
        <div className="segmented-tabs" role="tablist" aria-label="Password account action">
          <button type="button" role="tab" aria-selected={passwordMode === 'register'} className={passwordMode === 'register' ? 'selected' : ''} onClick={() => setPasswordMode('register')}>Create account</button>
          <button type="button" role="tab" aria-selected={passwordMode === 'login'} className={passwordMode === 'login' ? 'selected' : ''} onClick={() => setPasswordMode('login')}>Sign in</button>
        </div>
        {passwordMode === 'register' && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" minLength={2} maxLength={80} required /></label>}
        <label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="3–30 letters, numbers, or underscores" minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required /></label>
        <label>Password<input autoComplete={passwordMode === 'register' ? 'new-password' : 'current-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={passwordMode === 'register' ? 'At least 12 characters' : 'Your password'} minLength={passwordMode === 'register' ? 12 : 1} maxLength={128} required /></label>
        {passwordMode === 'register' && <label>Participation role<select value={walletRole} onChange={(event) => setWalletRole(event.target.value as 'prosumer' | 'consumer' | 'both' | 'funder')}><option value="consumer">Energy Consumer · buy locally generated energy</option><option value="prosumer">Energy Producer · offer generated energy</option><option value="both">Producer & Consumer · buy and offer energy</option><option value="funder">Investor · register non-cash project interest</option></select></label>}
        <button className="button button-primary" disabled={busy} type="submit"><CheckCircle2 size={16} /> {busy ? 'Please wait…' : passwordMode === 'register' ? 'Create account' : 'Sign in'} <ArrowRight size={15} /></button>
        <small>Use a unique password. Passwords are stored as salted hashes. Password reset is not available because no recovery channel is configured.</small>
        {passwordMode === 'register' && <small>You can link a browser EVM wallet later in Settings. Until then, wallet-required marketplace and blockchain actions are unavailable.</small>}
      </form> : <form onSubmit={(event) => { event.preventDefault(); onWallet() }}>
        <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" minLength={2} maxLength={80} required /></label>
        <label>Participation role<select value={walletRole} onChange={(event) => setWalletRole(event.target.value as 'prosumer' | 'consumer' | 'both' | 'funder')}><option value="consumer">Energy Consumer · buy locally generated energy</option><option value="prosumer">Energy Producer · offer generated energy</option><option value="both">Producer & Consumer · buy and offer energy</option><option value="funder">Investor · register non-cash project interest</option></select></label>
        <label>Browser EVM wallet<select value={selectedWalletId} onChange={(event) => setSelectedWalletId(event.target.value)} required>
          {walletProviders.length === 0 && <option value="">No wallet detected</option>}
          {walletProviders.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
        </select></label>
        <button className="button button-outline" type="button" onClick={onRefreshWallets}>Refresh wallet list</button>
        <button className="button button-primary" disabled={busy || walletProviders.length === 0} type="submit"><Wallet size={16} /> {busy ? 'Connecting…' : 'Create account with wallet'} <ArrowRight size={15} /></button>
        <small>Bright Ledger only requests a signature; it never asks for your seed phrase or private key. Compatible injected EVM wallets include Trust Wallet and Phantom’s EVM mode. Solana-only Phantom requires separate support.</small>
      </form>}
    </div></section>
    <footer className="landing-footer"><Logo compact /><span>The Future of Energy</span><span>Energy delivery, payments, and environmental claims require independent verification.</span><button onClick={onExplore}>Enter marketplace <ArrowRight size={14} /></button></footer>
  </main>
}

function Disclosure({ onAccept }: { onAccept: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  return <div className="disclosure-backdrop"><section className="disclosure-card" role="dialog" aria-modal="true" aria-labelledby="disclosure-title" aria-describedby="disclosure-copy"><span className="disclosure-icon"><ShieldCheck size={22} /></span><span className="section-kicker">PROTOTYPE · TESTNET ONLY</span><h2 id="disclosure-title">Please use sample data only</h2><p id="disclosure-copy">Bright Ledger is a prototype, not a live energy or financial service. It does not deliver electricity, accept investments, transfer real-world money, or pay returns. If a Sepolia contract is configured, trade escrow can transfer testnet SepoliaETH with no real-world value and still requires wallet approval and network fees. Never connect a wallet holding valuable assets or use mainnet. Solar estimates and AI reviews are advisory, not verified engineering or financial advice. Use fictional names and site details, do not upload genuine or sensitive documents, and do not submit sensitive credentials. Records are stored in PostgreSQL and may not meet production security or privacy requirements. Seek qualified review before real-world use.</p><label className="disclosure-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I understand and will use fictional/sample data and testnet wallets only.</span></label><button className="button button-primary" onClick={onAccept} disabled={!confirmed}>Continue to prototype <ArrowRight size={15} /></button></section></div>
}

function Status({ status }: { status: string }) {
  const styles: Record<string, string> = { Settled: 'success', 'Evidence needed': 'warning', 'Under review': 'info', 'Ready to settle': 'info', Disputed: 'danger', 'Awaiting confirmation': 'warning', Open: 'success', Funding: 'info', Operational: 'success', Review: 'warning' }
  return <span className={`status-badge ${styles[status] ?? 'neutral'}`}><i />{status}</span>
}

function Market({ listings, marketTab, setMarketTab, onMatch, query, setQuery, onInfo }: {
  listings: Listing[]
  marketTab: 'offers' | 'requests'
  setMarketTab: (value: 'offers' | 'requests') => void
  onMatch: (listing: Listing) => void
  query: string
  setQuery: (value: string) => void
  onInfo: () => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [areaFilter, setAreaFilter] = useState('All areas')
  const [sourceFilter, setSourceFilter] = useState('All sources')
  const [sortBy, setSortBy] = useState('price')
  const visibleListings = listings
    .filter((item) => item.type === (marketTab === 'offers' ? 'offer' : 'request'))
    .filter((item) => `${item.owner} ${item.area} ${item.source} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => areaFilter === 'All areas' || item.area === areaFilter)
    .filter((item) => sourceFilter === 'All sources' || item.source === sourceFilter)
    .sort((a, b) => sortBy === 'quantity' ? b.quantity - a.quantity : sortBy === 'newest' ? b.id.localeCompare(a.id) : a.price - b.price)

  return <div className="page-stack">
    <section className="market-hero">
      <div><span className="section-kicker">LOCAL ENERGY EXCHANGE</span><h2>Good energy, going places.</h2><p>Discover renewable power listed by neighbors in your local service area.</p><div className="market-hero-stats"><span><b>{visibleListings.length}</b> matching {marketTab}</span><i /><span><b>{visibleListings.reduce((sum, listing) => sum + listing.quantity, 0).toFixed(1)} kWh</b> listed</span></div></div>
      <div className="market-illustration"><div className="illustration-sun"><Sun size={30} /></div><div className="energy-path path-one" /><div className="energy-path path-two" /><div className="illustration-home"><Bolt size={28} /></div><div className="illustration-node node-one" /><div className="illustration-node node-two" /></div>
    </section>
    <div className="market-controls" data-tour-target="market">
      <div className="segmented-tabs"><button className={marketTab === 'offers' ? 'selected' : ''} onClick={() => setMarketTab('offers')}>Energy offers <span>{listings.filter((item) => item.type === 'offer').length}</span></button><button className={marketTab === 'requests' ? 'selected' : ''} onClick={() => setMarketTab('requests')}>Buy requests <span>{listings.filter((item) => item.type === 'request').length}</span></button></div>
      <div className="filter-tools"><label className="inline-search"><Search size={16} /><input placeholder="Search by area or source" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="button button-outline" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={15} /> Filters</button></div>
    </div>
    {filtersOpen && <div className="market-filter-panel"><label>Service area<select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option>All areas</option>{Array.from(new Set(listings.map((item) => item.area))).sort().map((area) => <option key={area}>{area}</option>)}</select></label><label>Renewable source<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All sources</option>{Array.from(new Set(listings.map((item) => item.source))).sort().map((source) => <option key={source}>{source}</option>)}</select></label><button className="text-link" onClick={() => { setAreaFilter('All areas'); setSourceFilter('All sources') }}>Clear filters</button></div>}
    <div className="listing-results-head"><div><b>{visibleListings.length} {marketTab === 'offers' ? 'offers' : 'requests'} nearby</b><span> · sorted by {sortBy === 'price' ? 'best price' : sortBy === 'quantity' ? 'energy quantity' : 'newest'}</span></div><label className="select-control">Sort by<select aria-label="Sort market listings" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="price">Best price</option><option value="quantity">Most energy</option><option value="newest">Newest</option></select><ChevronDown size={14} /></label></div>
    {visibleListings.length === 0 ? <div className="empty-state"><Sun size={26} /><h3>No listings found</h3><p>Try another search or switch to the other side of the market.</p></div> : <div className="market-list">{visibleListings.map((item) => <article className="market-listing" key={item.id}><div className="listing-person"><div className={`listing-avatar ${item.type === 'request' ? 'request-avatar' : ''}`}>{item.owner.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><b>{item.owner}</b><small>{item.area} <span>·</span> {item.id}</small></div></div><div className="listing-detail"><span>Energy</span><b>{item.quantity} kWh</b><small>{item.source}</small></div><div className="listing-detail"><span>{marketTab === 'offers' ? 'Price' : 'Max price'}</span><b>${item.price.toFixed(2)}<small> / kWh</small></b><small>{marketTab === 'offers' ? 'Fixed rate' : 'Buyer’s limit'}</small></div><div className="listing-detail delivery"><span>Delivery window</span><b>{item.window.split(',')[0]}</b><small>{item.window.includes(',') ? item.window.split(',').slice(1).join(',') : item.window}</small></div><div className="listing-action"><Status status="Open" /><button className="button button-small" onClick={() => onMatch(item)}>{marketTab === 'offers' ? 'Request match' : 'Propose match'} <ArrowRight size={14} /></button></div></article>)}</div>}
    <div className="market-disclosure"><ShieldCheck size={15} /><span>Shared market · prices and energy volumes are simulated. No real payments or grid delivery.</span><button onClick={onInfo}>How matching works <ArrowRight size={13} /></button></div>
  </div>
}

function ListingPage({ title, listings, onCreate, onAction }: { title: string; listings: Listing[]; onCreate: () => void; onAction: (listing: Listing, action: 'pause' | 'resume' | 'cancel') => void }) {
  return <div className="page-stack"><section className="panel list-page-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR LISTINGS</span><h2>{title}</h2><p>Manage availability in the shared marketplace.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create listing</button></div>{listings.length === 0 ? <div className="empty-state"><Bolt size={26} /><h3>Nothing here just yet</h3><p>Publish your first energy listing to get started.</p><button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create listing</button></div> : <div className="responsive-table"><table className="data-table"><thead><tr><th>Listing</th><th>Quantity</th><th>Price / kWh</th><th>Location</th><th>Delivery window</th><th>Status</th><th>Actions</th></tr></thead><tbody>{listings.map((item) => <tr key={item.id}><td><b>{item.id}</b><small>{item.source}</small></td><td>{item.quantity} kWh</td><td>${item.price.toFixed(2)}</td><td>{item.area}</td><td>{item.window}</td><td><Status status={item.status} /></td><td>{item.status === 'Open' ? <button className="table-action" onClick={() => onAction(item, 'pause')}>Pause</button> : item.status === 'Paused' ? <button className="table-action" onClick={() => onAction(item, 'resume')}>Resume</button> : <span className="muted-cell">Unavailable</span>}{['Open', 'Paused'].includes(item.status) && <button className="table-action" onClick={() => onAction(item, 'cancel')}>Cancel</button>}</td></tr>)}</tbody></table></div>}</section><div className="helper-note"><CircleHelp size={16} /><span>Marketplace actions coordinate records only. They do not deliver electricity or process payments.</span></div></div>
}

function Trades({ trades, statusFilter, setStatusFilter, state, role, walletAddress, chainPaymentsEnabled, onSettle, onConfirm, onCommit, onEvidence, onReviewEvidence, onCopy }: {
  trades: Trade[]
  statusFilter: string
  setStatusFilter: (value: string) => void
  state: AppState
  role: Role
  walletAddress: string
  chainPaymentsEnabled: boolean
  onSettle: (trade: Trade) => void
  onConfirm: (trade: Trade) => void
  onCommit: (trade: Trade) => void
  onEvidence: (trade: Trade) => void
  onReviewEvidence: (item: Evidence) => void
  onCopy: (text: string) => void
}) {
  function nextStep(trade: Trade) {
    const isBuyer = Boolean(walletAddress && trade.buyerWalletAddress?.toLowerCase() === walletAddress.toLowerCase())
    const isSeller = Boolean(walletAddress && trade.sellerWalletAddress?.toLowerCase() === walletAddress.toLowerCase())
    const evidence = state.evidence.find((item) => item.trade === trade.id)
    if (trade.status === 'Awaiting confirmation') return trade.hasConfirmed
      ? <span className="muted-cell">Waiting for the other participant</span>
      : <button className="table-action" onClick={() => onConfirm(trade)}>Confirm terms <ArrowRight size={13} /></button>
    if (trade.status === 'Awaiting buyer escrow') {
      if (!isBuyer) return <span className="muted-cell">Waiting for buyer to fund escrow</span>
      if (!trade.buyerWalletAddress || !trade.sellerWalletAddress) return <span className="muted-cell">Both wallets are required</span>
      return <button className="table-action" onClick={() => onCommit(trade)}>{chainPaymentsEnabled ? 'Fund Sepolia escrow' : 'Record commitment'} <ArrowRight size={13} /></button>
    }
    if (trade.status === 'Evidence needed') {
      if (isSeller) return <button className="table-action" onClick={() => onEvidence(trade)}>Submit delivery evidence <ArrowRight size={13} /></button>
      return <span className="muted-cell">Waiting for seller evidence</span>
    }
    if (trade.status === 'Under review' && evidence?.status === 'Pending') {
      if (evidence.buyerCanReview && isBuyer) return <button className="table-action" onClick={() => onReviewEvidence(evidence)}>Review delivery <ArrowRight size={13} /></button>
      return <span className="muted-cell">Waiting for buyer review</span>
    }
    if (trade.status === 'Disputed' && evidence?.status === 'Disputed' && ['Verifier', 'Admin'].includes(role)) {
      return <button className="table-action" onClick={() => onReviewEvidence(evidence)}>Resolve dispute <ArrowRight size={13} /></button>
    }
    if (trade.status === 'Ready to settle') return <button className="table-action" onClick={() => onSettle(trade)}>Settle <ArrowRight size={13} /></button>
    if (trade.status === 'Settled' || trade.status === 'Refunded' || trade.status === 'Cancelled') return <span className="muted-cell">Complete <Check size={14} /></span>
    return <span className="muted-cell">In progress <Clock3 size={14} /></span>
  }

  return <div className="page-stack">
    <div className="trade-summary-cards" data-tour-target="trades">
      <div className="mini-stat"><span>All trades</span><b>{state.trades.length.toString().padStart(2, '0')}</b><small>Across your account</small></div>
      <div className="mini-stat"><span>In progress</span><b>{state.trades.filter((trade) => !['Settled', 'Refunded', 'Cancelled'].includes(trade.status)).length.toString().padStart(2, '0')}</b><small>Awaiting next action</small></div>
      <div className="mini-stat"><span>Energy exchanged</span><b>{state.trades.filter((trade) => trade.status === 'Settled').reduce((sum, trade) => sum + trade.quantity, 0).toFixed(1)} <em>kWh</em></b><small>Settled records</small></div>
    </div>
    <section className="panel list-page-panel">
      <div className="panel-heading"><div><span className="section-kicker">AUDITABLE BY DESIGN</span><h2>Trade activity</h2>      <p>The seller submits delivery evidence; the buyer approves to complete the trade or opens a dispute.</p></div>
        <div className="filter-select-wrap"><Filter size={14} /><select aria-label="Filter trades by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All status</option><option>Awaiting confirmation</option><option>Awaiting buyer escrow</option><option>Evidence needed</option><option>Under review</option><option>Ready to settle</option><option>Disputed</option><option>Settled</option><option>Refunded</option></select><ChevronDown size={13} /></div>
      </div>
      {trades.length === 0
        ? <div className="empty-state"><Activity size={26} /><h3>No trades match this view</h3><p>Change the filter to see your market activity.</p></div>
        : <div className="responsive-table"><table className="data-table"><thead><tr><th>Trade ID</th><th>Participants</th><th>Energy</th><th>Unit price</th><th>Last update</th><th>Status</th><th>Next step</th></tr></thead><tbody>{trades.map((trade) => <tr key={trade.id}><td><b>{trade.id}</b><small><button className="hash-copy" onClick={() => onCopy(trade.hash)}><Copy size={11} /> {trade.hash}</button></small></td><td><span className="participants">{trade.buyer}<small>↔</small>{trade.seller}</span></td><td><b>{trade.quantity} kWh</b></td><td>${trade.price.toFixed(2)}</td><td>{trade.time}</td><td><Status status={trade.status} /></td><td>{nextStep(trade)}</td></tr>)}</tbody></table></div>}
      <div className="trade-flow"><span className="flow-step active"><i>1</i>Both confirm terms</span><span className="flow-connector" /><span className="flow-step active"><i>2</i>{chainPaymentsEnabled ? 'Buyer funds escrow' : 'Buyer commitment'}</span><span className="flow-connector" /><span className="flow-step"><i>3</i>Seller submits evidence</span><span className="flow-connector" /><span className="flow-step"><i>4</i>Buyer approves to complete</span></div>
    </section>
    <div className="helper-note"><ShieldCheck size={16} /><span>{chainPaymentsEnabled ? 'Only the buyer sends Sepolia escrow. Delivery evidence is not a payment transaction; a dispute keeps escrow locked.' : 'This deployment records trade decisions without moving funds. Delivery evidence is never a payment transaction.'}</span></div>
  </div>
}

function EvidencePage({ evidence, role, onReview, onSelect, onDownload }: { evidence: Evidence[]; role: Role; onReview: (item: Evidence) => void; onSelect: (item: Evidence) => void; onDownload: (item: Evidence) => void }) {
  return <div className="page-stack">
    <div className="evidence-summary" data-tour-target="evidence"><div><span className="evidence-summary-icon"><ShieldCheck size={20} /></span><span><b>{evidence.filter((item) => item.status === 'Pending').length} records need review</b><small>AI checks are advisory; readings are not independently verified.</small></span></div><span className="review-role"><span className="mini-dot gold" /> Current role: {role}</span></div>
    <div className="evidence-list">{evidence.map((item) => <article className="panel evidence-card" key={item.id}>
      <div className="evidence-card-head"><div><div className="evidence-id">{item.id} <span className="source-pill"><span className="mini-dot gold" /> SUBMITTED RECORD</span></div><h3>{item.project}</h3><p>{item.trade} <span>·</span> Submitted {item.interval}</p></div><Status status={item.status} /></div>
      <div className="evidence-data"><div><span>Reported generation</span><b>{item.quantity} <small>kWh</small></b></div><div><span>Reading interval</span><b>{item.interval}</b></div><div><span>Evidence source</span><b>{item.source}</b></div><div><span>Provenance</span><b className="provenance"><ShieldCheck size={14} /> Human review status only</b></div></div>
      {item.evidenceFileSha256 && <div className="evidence-file-hash">Attached file SHA-256: <code>{item.evidenceFileSha256}</code></div>}
      {item.evidenceFileAvailable && <button className="text-link evidence-download" onClick={() => onDownload(item)}><Download size={14} /> Download attached evidence</button>}
      {item.aiReview && <div className="evidence-ai-summary"><b>AI triage · {item.aiReview.analysis.confidence} confidence</b><span>{item.aiReview.analysis.summary}</span><small>{item.aiReview.model} · advisory only</small></div>}
      {item.reason && <div className="rejection-reason">{item.status === 'Disputed' ? 'Buyer dispute reason' : 'Review note'}: {item.reason}</div>}
      <div className="evidence-card-foot"><button className="text-link" onClick={() => onSelect(item)}>View reading details <ArrowRight size={14} /></button>      {(item.status === 'Pending' && item.buyerCanReview) || (item.status === 'Disputed' && ['Verifier', 'Admin'].includes(role))
        ? <div className="evidence-actions"><button className="button button-secondary" onClick={() => onReview(item)}>{item.status === 'Disputed' ? 'Resolve dispute' : 'Review delivery'}</button></div>
        : item.status === 'Pending' && <span className="permission-note"><ShieldCheck size={14} /> Waiting for the buyer to review</span>}</div>
    </article>)}</div>
  </div>
}

function Rewards({ state }: { state: AppState }) {
  const settled = state.trades.filter((trade) => trade.status === 'Settled')
  return <div className="page-stack"><section className="rewards-hero"><div className="rewards-orbit orbit-one" /><div className="rewards-orbit orbit-two" /><div className="rewards-copy"><span className="section-kicker">GOOD ENERGY, RECOGNIZED</span><h2>Every clean choice<br />adds up.</h2><p>Community points recognize participation in a brighter local grid.</p><div className="rewards-total"><span>YOUR POINT BALANCE</span><b><Leaf size={23} /> {new Intl.NumberFormat('en-IN').format(state.points)} <small>pts</small></b><small>No cash value · Non-redeemable</small></div></div><div className="rewards-coin"><Sun size={42} /><span>BL</span></div></section><div className="reward-rule-row"><div className="panel rule-card"><span className="reward-rule-icon"><Zap size={18} /></span><div><span className="section-kicker">CURRENT REWARD RULE</span><h3>10 points per eligible kWh</h3><p>Points are issued once, after evidence is approved and the related trade is settled.</p></div></div><div className="panel rule-card"><span className="reward-rule-icon green-rule"><ShieldCheck size={18} /></span><div><span className="section-kicker">YOUR CONTRIBUTION</span><h3>{settled.reduce((sum, trade) => sum + trade.quantity, 0).toFixed(1)} kWh settled</h3><p>Only eligible settled trades contribute to this point balance.</p></div></div></div><section className="panel list-page-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR HISTORY</span><h2>Points activity</h2></div><span className="no-cash-chip">COMMUNITY POINTS · NO CASH VALUE</span></div><div className="reward-history">{settled.map((trade) => <div className="reward-row" key={trade.id}><span className="reward-row-icon"><Leaf size={16} /></span><span><b>Clean energy trade settled</b><small>{trade.id} · {trade.quantity} kWh · Recorded activity</small></span><b className="reward-points">+{Math.round(trade.quantity * 10)} pts</b></div>)}</div></section></div>
}

function SolarProjectWorkspace({ projectId, role, identity, onClose, onNotify, onRefresh }: { projectId: string; role: Role; identity: string; onClose: () => void; onNotify: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [workspace, setWorkspace] = useState<SolarWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<SettlementPreview | null>(null)
  const [intervalDefaults] = useState(() => {
    const end = new Date()
    const start = new Date(end.getTime() - 3600000)
    return { start: start.toISOString().slice(0, 16), end: end.toISOString().slice(0, 16) }
  })
  const canVerify = role === 'Verifier' || role === 'Admin'
  const mayManage = canVerify || workspace?.project.owner === identity
  const projectPath = `/api/solar/projects/${encodeURIComponent(projectId)}`

  const loadWorkspace = useCallback(async () => {
    setError('')
    try {
      const result = await apiGet<{ data: SolarWorkspaceData }>(projectPath)
      setWorkspace(result.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Solar project could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    let active = true
    void apiGet<{ data: SolarWorkspaceData }>(projectPath).then((result) => {
      if (active) setWorkspace(result.data)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Solar project could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [projectPath])

  async function mutate(path: string, body: unknown, success: string) {
    setBusy(true)
    setError('')
    try {
      await apiPost(path, body)
      setPreview(null)
      await loadWorkspace()
      await onRefresh()
      onNotify(success)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Solar project update failed.'
      setError(message)
      onNotify(message)
    } finally {
      setBusy(false)
    }
  }

  async function previewSettlement() {
    setBusy(true)
    setError('')
    try {
      const result = await apiPost<{ data: SettlementPreview }>(`${projectPath}/settlement-runs/preview`, {})
      setPreview(result.data)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Settlement preview could not be calculated.'
      setError(message)
      onNotify(message)
    } finally {
      setBusy(false)
    }
  }

  async function exportReport() {
    try {
      const report = await apiGet<Record<string, unknown>>(`${projectPath}/export`)
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectId.toLowerCase()}-prototype-report.json`
      link.click()
      URL.revokeObjectURL(url)
      onNotify('Project report downloaded.')
    } catch (exportError) {
      onNotify(exportError instanceof Error ? exportError.message : 'Could not export this project report.')
    }
  }

  if (loading) return <section className="panel solar-workspace"><div className="solar-workspace-loading"><span className="loading-spinner" /><b>Loading solar project records…</b></div></section>
  if (!workspace) return <section className="panel solar-workspace"><div className="solar-workspace-heading"><div><span className="section-kicker">PROJECT WORKSPACE</span><h2>Project details unavailable</h2></div><button className="button button-outline" onClick={onClose}>Close</button></div><p role="alert" className="solar-workspace-error">{error}</p><button className="button button-secondary" onClick={() => void loadWorkspace()}>Try again</button></section>

  const { project, site, funding, generation, market, attributes, settlements, milestones, timeline, disputes, impact } = workspace
  const openDispute = disputes.find((dispute) => dispute.status === 'OPEN')
  return <section className="panel solar-workspace">
    <div className="solar-workspace-heading"><div><span className="section-kicker">FUNDRAISING PROJECT · {project.id}</span><h2>{project.name}</h2><p>{site?.publicLocation ?? 'Location withheld'} · {site?.roofType ?? 'Solar site'} · <Status status={project.status} /></p></div><div className="solar-workspace-heading-actions"><button className="button button-outline" onClick={() => void exportReport()}><Download size={14} /> Export records</button><button className="icon-button" aria-label="Close project details" onClick={onClose}><X size={18} /></button></div></div>
    <div className="solar-workspace-banner"><ShieldCheck size={16} /><span>Prototype records only: investor contributions, readings, estimates and settlements are simulated. No funds are collected or distributed.</span></div>
    {error && <p role="alert" className="solar-workspace-error">{error}</p>}
    <div className="solar-workspace-metrics">
      <div><span>Contributions recorded</span><b>{formatUSD(funding.receivedMinor / 100)}</b><small>of {formatUSD(funding.targetMinor / 100)} goal</small></div>
      <div><span>Verified generation</span><b>{(generation.verifiedWh / 1000).toLocaleString()} kWh</b><small>{generation.batches.length} submitted records</small></div>
      <div><span>Unallocated energy</span><b>{(generation.availableWh / 1000).toLocaleString()} kWh</b><small>Verified records only</small></div>
      <div><span>Illustrative impact</span><b>{impact.estimatedKgCo2e.toLocaleString()} kg CO₂e</b><small>Not independently verified</small></div>
    </div>
    <div className="solar-workspace-columns">
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">SITE & ESTIMATE</span><h3>Site review</h3></div><Status status={site?.reviewStatus ?? 'Unknown'} /></div>
        {site && <><div className="solar-detail-grid"><span>Roof area<b>{site.roofAreaM2} m²</b></span><span>Usable area<b>{site.usableAreaM2} m²</b></span><span>Shading<b>{site.shadingPct}%</b></span><span>Grid status<b>{site.gridConnectionStatus}</b></span></div>
          {site.estimate && <div className="solar-estimate-card"><b>{site.estimate.capacityKwp} kWp estimated capacity</b><span>{site.estimate.dailyKwh} kWh/day · {site.estimate.monthlyKwh} kWh/month · {formatUSD(site.estimate.capexMinor / 100)} indicative capex</span><small>{site.estimate.methodologyVersion} · {site.estimate.assumptions.note}</small></div>}
          {canVerify && ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES'].includes(site.reviewStatus) && <div className="solar-action-row"><button className="button button-approve" disabled={busy} onClick={() => void mutate(`/api/solar/sites/${encodeURIComponent(site.id)}/review`, { decision: 'APPROVED' }, 'Site approved in the prototype workflow.')}>Approve site</button><button className="button button-danger-outline" disabled={busy} onClick={() => void mutate(`/api/solar/sites/${encodeURIComponent(site.id)}/review`, { decision: 'NEEDS_CHANGES', reason: 'Additional evidence requested by reviewer.' }, 'Site returned for additional information.')}>Request changes</button></div>}
        </>}
        {site?.reviewStatus === 'APPROVED' && ['Review', 'Draft'].includes(project.status) && mayManage && <button className="button button-primary solar-full-button" disabled={busy} onClick={() => void mutate(`${projectPath}/publish`, {}, 'Fundraising page published; simulated contributions are now open.')}>Publish fundraising page <ArrowRight size={14} /></button>}
      </article>
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">INVESTOR INTEREST · SIMULATED</span><h3>Contributions & receipts</h3></div><span className="solar-count">{funding.contributions.length} records</span></div>
        <div className="solar-workspace-progress"><div className="funding-progress-head"><span>Fundraising goal</span><b>{pct(funding.receivedMinor, funding.targetMinor)}%</b></div><div className="progress-track"><i style={{ width: `${pct(funding.receivedMinor, funding.targetMinor)}%` }} /></div><span>{formatUSD(funding.remainingMinor / 100)} remaining · {funding.currency}</span></div>
        {mayManage && project.status === 'Funding' && <button className="button button-outline solar-full-button" disabled={busy} onClick={() => { if (window.confirm('Close this funding round? The API will complete it at target or mark it failed and record simulated refunds.')) void mutate(`${projectPath}/close-funding`, {}, 'Funding round closed and its result recorded.') }}>Close funding round</button>}
        {funding.contributions.length ? <div className="solar-record-list">{funding.contributions.map((item) => <div key={item.id}><span><b>{item.contributor}</b><small>{item.id} · {item.status}</small></span><b>{formatUSD(item.amountMinor / 100)}</b><button className="table-action" onClick={async () => { try { const receipt = await apiGet<{ data: Record<string, unknown> }>(`/api/solar/contributions/${encodeURIComponent(item.id)}/receipt`); await navigator.clipboard.writeText(JSON.stringify(receipt.data, null, 2)); onNotify('Contribution receipt copied.') } catch (receiptError) { onNotify(receiptError instanceof Error ? receiptError.message : 'Could not retrieve receipt.') } }}>Receipt</button></div>)}</div> : <p className="solar-empty-note">No contribution records yet.</p>}
      </article>
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">METER & GENERATION</span><h3>Generation evidence</h3></div><span className="solar-count">{generation.batches.length} batches</span></div>
        {['Funded', 'Operational'].includes(project.status) ? <form className="solar-inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`${projectPath}/generation-batches`, { energyKwh: Number(form.get('energyKwh')), intervalStart: new Date(String(form.get('intervalStart'))).toISOString(), intervalEnd: new Date(String(form.get('intervalEnd'))).toISOString(), sourceType: String(form.get('sourceType')), sourceReference: String(form.get('sourceReference')), meterRefHash: 'sha256:demo-meter', idempotencyKey: crypto.randomUUID() }, 'Generation record submitted for review.'); event.currentTarget.reset() }}>
          <label>Reading (kWh)<input name="energyKwh" type="number" min="0" max="10000" step="0.001" required /></label><div className="form-row"><label>Interval start<input name="intervalStart" type="datetime-local" defaultValue={intervalDefaults.start} required /></label><label>Interval end<input name="intervalEnd" type="datetime-local" defaultValue={intervalDefaults.end} required /></label></div><div className="form-row"><label>Evidence source<select name="sourceType"><option value="simulator">Illustrative meter sample</option><option value="csv">CSV import reference</option><option value="meter">Meter reading</option></select></label><label>Source reference<input name="sourceReference" maxLength={160} placeholder="Meter ID or file reference" /></label></div><button className="button button-secondary" type="submit" disabled={busy}>Submit generation record</button>
        </form> : <p className="solar-empty-note">Generation reporting opens after this project reaches its funding goal.</p>}
        <div className="solar-record-list">{generation.batches.map((batch) => <div className="solar-generation-row" key={batch.id}><span><b>{batch.id} · {(batch.energyWh / 1000).toLocaleString()} kWh</b><small>{batch.sourceType} · {new Date(batch.intervalStart).toLocaleString()} · {(batch.tradedWh ?? 0) / 1000} kWh traded · {(batch.allocatedWh / 1000).toLocaleString()} kWh attributes allocated{batch.anomalyFlags.length ? ` · ${batch.anomalyFlags.join('; ')}` : ''}</small></span><Status status={batch.verificationStatus} />{canVerify && !['VERIFIED', 'REJECTED'].includes(batch.verificationStatus) && <><button className="table-action" disabled={busy} onClick={() => void mutate(`/api/solar/generation-batches/${encodeURIComponent(batch.id)}/decision`, { decision: 'VERIFIED' }, 'Generation batch verified.')}>Verify</button><button className="table-action" disabled={busy} onClick={() => void mutate(`/api/solar/generation-batches/${encodeURIComponent(batch.id)}/decision`, { decision: 'REJECTED', reason: 'Reading not supported by the submitted record.' }, 'Generation batch rejected.')}>Reject</button></>}</div>)}</div>
        {['Funded', 'Operational'].includes(project.status) && <form className="solar-inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`${projectPath}/market-trades`, { generationBatchId: String(form.get('generationBatchId')), energyKwh: Number(form.get('energyKwh')), priceUSDPerKwh: Number(form.get('priceUSDPerKwh')), idempotencyKey: crypto.randomUUID() }, 'Simulated energy sale recorded; no payment or delivery occurred.'); event.currentTarget.reset() }}>
          <span className="section-kicker">RECORD A SIMULATED SALE</span><label>Verified generation batch<select name="generationBatchId" required defaultValue="">{generation.batches.filter((batch) => batch.verificationStatus === 'VERIFIED' && batch.energyWh > (batch.tradedWh ?? 0)).map((batch) => <option value={batch.id} key={batch.id}>{batch.id} · {(batch.energyWh - (batch.tradedWh ?? 0)) / 1000} kWh untraded</option>)}</select></label><div className="form-row"><label>Energy (kWh)<input name="energyKwh" type="number" min="0.001" step="0.001" required /></label><label>Agreed USD/kWh<input name="priceUSDPerKwh" type="number" min="0.01" max="1000" step="0.01" defaultValue="0.12" required /></label></div><small className="solar-provenance-note">Price is user-entered. This creates a prototype ledger record, not a real sale, payment, or grid delivery.</small><button className="button button-secondary" type="submit" disabled={busy || !generation.batches.some((batch) => batch.verificationStatus === 'VERIFIED' && batch.energyWh > (batch.tradedWh ?? 0))}>Record trade and proceeds</button>
        </form>}
        <div className="solar-record-list">{market.trades.map((trade) => <div className="solar-trade-row" key={trade.id}><span><b>{trade.id} · {(trade.energyWh / 1000).toLocaleString()} kWh</b><small>{trade.generationBatchId} · ${ (trade.priceMinorPerKwh / 100).toFixed(2)}/kWh · {trade.status}</small></span><b>{formatUSD(trade.grossAmountMinor / 100)}</b></div>)}</div>
      </article>
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">SETTLEMENT & ALLOCATION</span><h3>Settlement waterfall</h3></div><span className="solar-count">{settlements.length} finalized</span></div>
        <p className="solar-helper-copy">Review settlement records in integer USD cents. Allocation terms: Investors {project.allocationRules.funderPct}% · Project Owner {project.allocationRules.ownerPct}% · operator {project.allocationRules.operatorPct}%.</p>
        {market.trades.map((trade) => <div className="solar-trade-row" key={trade.id}><span><b>{trade.id}</b><small>{(trade.energyWh / 1000).toLocaleString()} kWh · {trade.status}</small></span><b>{formatUSD(trade.grossAmountMinor / 100)}</b></div>)}
        <button className="button button-outline solar-full-button" disabled={busy || !canVerify} onClick={() => void previewSettlement()}>{canVerify ? 'Calculate settlement preview' : 'Verifier role required'}</button>
        {preview && <div className="solar-estimate-card settlement-preview"><b>Distributable: {formatUSD(preview.distributablePoolMinor / 100)}</b>{preview.allocations.map((allocation, index) => <span key={`${allocation.recipient}-${index}`}>{allocation.type} · {allocation.recipient}: {formatUSD(allocation.amountMinor / 100)}</span>)}<small>Input {preview.inputHash} · Output {preview.outputHash}</small><button className="button button-primary" disabled={busy || !canVerify} onClick={() => void mutate(`${projectPath}/settlement-runs`, preview, 'Settlement finalized with validated allocations.')}>Finalize settlement</button></div>}
        {settlements.map((run) => <div className="solar-trade-row" key={run.id}><span><b>{run.id}</b><small>{run.status} · {new Date(run.finalizedAt).toLocaleString()}</small></span><b>{formatUSD(run.distributablePoolMinor / 100)}</b></div>)}
      </article>
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">RENEWABLE ATTRIBUTES</span><h3>Energy allocation</h3></div><span className="solar-count">{attributes.length} attributes</span></div>
        <form className="solar-inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`${projectPath}/attributes/allocate`, { generationBatchId: String(form.get('generationBatchId')), tradeId: String(form.get('tradeId')), energyWh: Math.round(Number(form.get('energyKwh')) * 1000), idempotencyKey: crypto.randomUUID() }, 'Renewable attribute linked to a trade record.'); event.currentTarget.reset() }}>
          <label>Verified generation batch<select name="generationBatchId" required defaultValue="">{generation.batches.filter((batch) => batch.verificationStatus === 'VERIFIED' && market.trades.some((trade) => trade.generationBatchId === batch.id && trade.energyWh > attributes.filter((attribute) => attribute.allocatedToTradeId === trade.id).reduce((sum, attribute) => sum + attribute.energyWh, 0))).map((batch) => <option value={batch.id} key={batch.id}>{batch.id} · verified</option>)}</select></label><div className="form-row"><label>Related trade<select name="tradeId" required defaultValue="">{market.trades.map((trade) => <option value={trade.id} key={trade.id}>{trade.id}</option>)}</select></label><label>Energy (kWh)<input name="energyKwh" type="number" min="0.001" step="0.001" required /></label></div><button className="button button-secondary" type="submit" disabled={busy || !generation.batches.some((batch) => batch.verificationStatus === 'VERIFIED' && market.trades.some((trade) => trade.generationBatchId === batch.id && trade.energyWh > attributes.filter((attribute) => attribute.allocatedToTradeId === trade.id).reduce((sum, attribute) => sum + attribute.energyWh, 0)))}>Allocate verified energy</button>
        </form>
        {attributes.map((item) => <div className="solar-trade-row" key={item.id}><span><b>{item.id} · {(item.energyWh / 1000).toLocaleString()} kWh</b><small>{item.generationBatchId} → {item.allocatedToTradeId} · {item.status}</small></span><ShieldCheck size={15} /></div>)}<small className="solar-provenance-note">These records are not official renewable-energy certificates or proof of delivery.</small>
      </article>
      <article className="solar-workspace-section"><div className="solar-section-title"><div><span className="section-kicker">MILESTONES & DISPUTES</span><h3>Project governance</h3></div><span className="solar-count">{disputes.filter((item) => item.status === 'OPEN').length} open disputes</span></div>
        <form className="solar-inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`${projectPath}/milestones`, { title: String(form.get('title')), evidenceReference: String(form.get('evidenceReference')) }, 'Project milestone submitted.'); event.currentTarget.reset() }}><div className="form-row"><label>Milestone<input name="title" placeholder="Installation complete" minLength={3} required /></label><label>Evidence reference<input name="evidenceReference" placeholder="Document or inspection reference" /></label></div><button className="button button-secondary" disabled={busy}>Submit milestone</button></form>
        <div className="solar-record-list">{milestones.map((milestone) => <div key={milestone.id}><span><b>{milestone.title}</b><small>{milestone.id} · {milestone.status}{milestone.evidenceHash ? ` · ${milestone.evidenceHash}` : ''}</small></span><Status status={milestone.status} />{canVerify && milestone.status === 'SUBMITTED' && <button className="table-action" disabled={busy} onClick={() => void mutate(`${projectPath}/milestones/${encodeURIComponent(milestone.id)}/verify`, { decision: 'APPROVED' }, 'Milestone approved.')}>Approve</button>}</div>)}</div>
        <form className="solar-inline-form" onSubmit={(event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason') ?? ''); void mutate(`${projectPath}/disputes`, { reason }, 'Dispute opened; settlement and project actions are frozen.'); event.currentTarget.reset() }}><label>Open a project dispute<textarea name="reason" minLength={8} maxLength={500} placeholder="Describe the record that needs review" required /></label><button className="button button-danger-outline" disabled={busy}>Open dispute</button></form>
        {disputes.map((dispute) => <div className="solar-dispute-row" key={dispute.id}><span><b>{dispute.id} · {dispute.status}</b><small>{dispute.reason}{dispute.resolution ? ` · Resolution: ${dispute.resolution}` : ''}</small></span>{canVerify && dispute.status === 'OPEN' && <button className="table-action" disabled={busy} onClick={() => { const resolution = window.prompt('Add a resolution note (at least 8 characters):'); if (resolution) void mutate(`/api/solar/disputes/${encodeURIComponent(dispute.id)}/resolve`, { resolution }, 'Dispute resolution recorded.') }}>Resolve</button>}</div>)}
        {openDispute && <p className="solar-freeze-note">Project is frozen while {openDispute.id} is open. Settlement preview is unavailable.</p>}
      </article>
      <article className="solar-workspace-section solar-impact-section"><div className="solar-section-title"><div><span className="section-kicker">CLIMATE ACCOUNTING</span><h3>Illustrative impact</h3></div><Leaf size={18} /></div><div className="solar-detail-grid"><span>Verified generation<b>{impact.simulatedKwh.toLocaleString()} kWh</b></span><span>Available for allocation<b>{impact.availableKwh.toLocaleString()} kWh</b></span><span>Estimated emissions factor<b>{impact.factor.kgCo2ePerKwh} kg CO₂e/kWh</b></span><span>Estimated avoided emissions<b>{impact.estimatedKgCo2e.toLocaleString()} kg CO₂e</b></span></div><p className="solar-provenance-note">{impact.disclaimer} Factor: {impact.factor.source} ({impact.factor.version}).</p></article>
    </div>
    <article className="solar-workspace-section solar-audit-section"><div className="solar-section-title"><div><span className="section-kicker">AUDIT EVENTS</span><h3>Lifecycle history</h3></div><span className="solar-count">{timeline.length} events</span></div>{timeline.length ? <div className="solar-audit-list">{timeline.map((event) => <div key={event.id}><span className="audit-event-dot" /><span><b>{event.action}</b><small>{event.detail}</small><small>{event.actor} · {new Date(event.timestamp).toLocaleString()}</small></span></div>)}</div> : <p className="solar-empty-note">No project events recorded yet.</p>}</article>
    {mayManage && project.status !== 'Completed' && project.status !== 'Cancelled' && <button className="button button-danger-outline solar-cancel-project" disabled={busy} onClick={() => { if (window.confirm('Cancel this prototype project? Accepted simulated contributions will be marked refunded.')) void mutate(`${projectPath}/cancel`, {}, 'Project cancelled and mock contribution records reversed.') }}>Cancel project and reverse mock funding</button>}
  </section>
}

function SolarProjectReviewQueue({ projects, onReview }: {
  projects: Project[]
  onReview: (project: Project, decision: 'approve' | 'reject') => void
}) {
  if (!projects.length) return null
  return <section className="panel list-page-panel"><div className="panel-heading"><div><span className="section-kicker">PROJECT REVIEW</span><h2>Fundraising projects awaiting review</h2><p>Approval allows a Project Owner to publish the fundraising page. It does not verify project costs or guarantee returns.</p></div></div><div className="solar-record-list">{projects.map((project) => <div key={project.id}><span><b>{project.name}</b><small>{project.id} · {project.location} · {project.permission}</small></span><button className="button button-danger-outline" onClick={() => onReview(project, 'reject')}>Reject</button><button className="button button-approve" onClick={() => onReview(project, 'approve')}>Approve</button></div>)}</div></section>
}

function SolarEstimateTransparency({ projects }: { projects: Project[] }) {
  if (!projects.length) return null
  return <section className="panel list-page-panel"><div className="panel-heading"><div><span className="section-kicker">ESTIMATE PROVENANCE</span><h2>Project cost estimates</h2><p>Cost estimates use submitter-provided assumptions; optional AI review is advisory.</p></div></div><div className="solar-record-list">{projects.map((project) => <div key={project.id}><span><b>{project.name} · {project.estimateReviewConfidence} confidence</b><small>{project.fundingMethodology} · {project.estimateModel === 'Not requested' ? 'AI review not requested' : `assessed by ${project.estimateModel}`}</small><small>{project.estimateReviewSummary}</small><small>{project.estimateLimitation}</small></span></div>)}</div></section>
}

function Projects({ projects, contributions, filter, setFilter, onFund, onCreate, onDistributeIncome, onOpen, workspaceId, onCloseWorkspace, role, identity, mockApiEnabled, onNotify, onRefresh }: { projects: Project[]; contributions: Contribution[]; filter: string; setFilter: (value: string) => void; onFund: (project: Project) => void; onCreate: () => void; onDistributeIncome: (event: React.FormEvent<HTMLFormElement>, project: Project) => void; onOpen: (projectId: string) => void; workspaceId: string; onCloseWorkspace: () => void; role: Role; identity: string; mockApiEnabled: boolean; onNotify: (message: string) => void; onRefresh: () => Promise<void> }) {
  return <div className="page-stack">
    <section className="solar-intro">
      <div><span className="section-kicker">COMMUNITY SOLAR · FUNDRAISING</span><h2>Bring a solar project<br />to the community.</h2><p>Project Owners present a solar site and funding goal. Investors can register interest; all contributions shown here are simulated and no money is transferred.</p><button className="button button-primary" data-tour-target="projects" onClick={onCreate}><Plus size={16} /> Create a fundraiser</button></div>
      <div className="solar-intro-art"><img src="/images/solarfield.jpg" alt="A field of solar panels under clear skies" /></div>
    </section>
    <div className="solar-toolbar"><div><b>Community solar projects</b><span> · {projects.length} opportunities</span></div><div className="filter-select-wrap"><Filter size={14} /><select aria-label="Filter solar projects" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All projects</option><option>Funding</option><option>Operational</option><option>Review</option></select><ChevronDown size={13} /></div></div>
    {projects.length === 0
      ? <div className="empty-state"><Sun size={26} /><h3>No projects found</h3><p>Submit a project with cost assumptions for independent review. Any participant role can propose a project.</p></div>
      : <div className="project-grid">{projects.map((project, index) => <article className="project-card" key={project.id}>
        <div className={`project-cover ${project.image}`}><img src={`/images/${['rooftop.jpg', 'rooftop_3.jpg', 'solarfield.jpg'][index % 3]}`} alt={`${project.name} solar project site`} /><span className="project-id">{project.id}</span><span className="project-cover-tag">COMMUNITY SOLAR</span></div>
        <div className="project-card-body"><div className="project-location"><span><Sun size={13} /> {project.location}</span><Status status={project.status} /></div>
          <h3>{project.name}</h3><p title={project.notes}>Project Owner: {project.owner} · {project.siteType}</p><span className="project-permission"><ShieldCheck size={12} /> {project.permission}</span>
          <div className="project-metrics"><div><span>Estimated capacity</span><b>{project.capacity} <small>kW</small></b></div><div><span>Available area</span><b>{project.area} <small>m²</small></b></div><div><span>Funding goal</span><b>{formatUSD(project.target)}</b></div></div>
          <div className="funding-progress-head"><span>Recorded simulated interests · {contributions.filter((item) => item.projectId === project.id).length}</span><b>{pct(project.raised, project.target)}%</b></div><div className="progress-track"><i style={{ width: `${pct(project.raised, project.target)}%` }} /></div>
          <div className="funding-amount"><span>{formatUSD(project.raised)} <small>interest recorded</small></span><span>{formatUSD(project.target - project.raised)} <small>goal remaining</small></span></div>
          <button className="button button-secondary project-action" disabled={!['Review', 'Funding'].includes(project.status) || project.raised >= project.target} onClick={() => onFund(project)}>{project.raised >= project.target ? 'Interest goal reached' : project.status === 'Review' ? 'Register interest · pending review' : project.status === 'Funding' ? 'Register investor interest' : 'Interest unavailable'} <ArrowRight size={15} /></button>
          {project.status === 'Review' && <small className="project-review-interest-note">Interest is simulated only. Independent approval is still required before fundraising can proceed.</small>}
          <BoaPanel project={project} role={role} identity={identity} onNotify={onNotify} />
          {['Funding', 'Operational'].includes(project.status) && <details className="project-income-panel">
            <summary>Record simulated income & allocate</summary>
            <p>Enter a prototype income amount. Bright Ledger allocates it by the project agreement and records the result; it does not collect or pay money.</p>
            <form className="solar-inline-form" onSubmit={(event) => onDistributeIncome(event, project)}>
              <label>Simulated income (USD)<input name="amountUsd" type="number" min="0.01" max="100000000" step="0.01" required /></label>
              <label>Income source<input name="source" minLength={3} maxLength={200} placeholder="Example: simulated monthly energy proceeds" required /></label>
              <button className="button button-secondary" type="submit">Allocate by project shares</button>
            </form>
            {project.incomeDistributions.length > 0 && <div className="project-income-records">{project.incomeDistributions.map((record) => <div key={record.id}>
              <b>{record.id} · {formatUSD(record.amountMinor / 100)}</b><small>{record.source} · {new Date(record.createdAt).toLocaleString()}</small>
              {record.allocations.map((allocation, index) => <small key={`${record.id}-${index}`}>{allocation.type} · {allocation.recipient}: {formatUSD(allocation.amountMinor / 100)}</small>)}
            </div>)}</div>}
          </details>}
          {mockApiEnabled && <button className="button button-outline project-action" onClick={() => onOpen(project.id)}>Open project workspace <ArrowRight size={15} /></button>}
        </div>
      </article>)}</div>}
    {mockApiEnabled && workspaceId && <SolarProjectWorkspace key={workspaceId} projectId={workspaceId} role={role} identity={identity} onClose={onCloseWorkspace} onNotify={onNotify} onRefresh={onRefresh} />}
    <div className="solar-disclaimer"><ShieldCheck size={15} /><span>Investor interest is a simulated, non-cash contribution—not an investment or funding commitment. Cost and capacity estimates use user-entered assumptions; returns are not offered or promised.</span></div>
  </div>
}

function BoaPanel({ project, role, identity, onNotify }: { project: Project; role: Role; identity: string; onNotify: (message: string) => void }) {
  const [data, setData] = useState<BoaData | null>(null)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState('0.01')
  const [unlockAt, setUnlockAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
  const isOwner = project.owner === identity || role === 'Project Owner'
  const canVerify = role === 'Verifier' || role === 'Admin'
  const load = useCallback(async () => {
    try {
      const result = await apiGet<{ data: BoaData }>(`/api/projects/${encodeURIComponent(project.id)}/boa`)
      setData(result.data)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not load operator assurance status.')
    }
  }, [project.id, onNotify])
  useEffect(() => { void load() }, [load])

  async function postBond() {
    setBusy(true)
    try {
      const { parseEther } = await import('ethers')
      const amountWei = parseEther(amount)
      const unlock = new Date(unlockAt)
      const transactionHash = await postOperatorBondOnChain(project.id, unlock, amountWei)
      await apiPost(`/api/projects/${encodeURIComponent(project.id)}/boa/bond`, { amountWei: amountWei.toString(), unlockAt: unlock.toISOString(), transactionHash })
      await load()
      onNotify('Operator performance bond locked in the BOA vault. It is separate from project funding.')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not post the operator bond.')
    } finally { setBusy(false) }
  }

  async function submitMilestone(milestone: BoaData['milestones'][number]) {
    const reference = window.prompt('Evidence reference (document URI, meter record, or hash context):')
    if (!reference) return
    setBusy(true)
    try {
      const { id } = await import('ethers')
      const evidenceHash = id(reference)
      const transactionHash = await submitOperatorMilestoneOnChain(project.id, milestone.id, evidenceHash)
      await apiPost(`/api/projects/${encodeURIComponent(project.id)}/boa/milestones/${encodeURIComponent(milestone.id)}/submit`, { evidenceHash, evidenceReference: reference, transactionHash })
      await load()
      onNotify('Milestone evidence submitted for independent review.')
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Could not submit milestone evidence.') } finally { setBusy(false) }
  }

  async function reviewMilestone(milestone: BoaData['milestones'][number], decision: 'approve' | 'reject') {
    const reason = window.prompt(decision === 'approve' ? 'Approval note (optional):' : 'Reason for rejection:')
    if (decision === 'reject' && !reason) return
    setBusy(true)
    try {
      const transactionHash = await reviewOperatorMilestoneOnChain(project.id, milestone.id, decision === 'approve', reason ?? '')
      await apiPost(`/api/projects/${encodeURIComponent(project.id)}/boa/milestones/${encodeURIComponent(milestone.id)}/review`, { decision, reason: reason ?? '', transactionHash })
      await load()
      onNotify(decision === 'approve' ? 'Milestone independently approved.' : 'Milestone rejected and returned for evidence.')
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Could not review milestone evidence.') } finally { setBusy(false) }
  }

  return <details className="boa-panel">
    <summary><ShieldCheck size={14} /> Bonded Operator Assurance <span>{data?.bond ? data.bond.status : 'bond not posted'}</span></summary>
    {!data ? <small>Loading assurance controls…</small> : <>
      <p className="boa-note">The operator bond is a refundable performance bond. Investor/project funding remains in separate records and cannot be withdrawn through this vault.</p>
      {!data.bond && isOwner && <div className="boa-form"><label>Bond amount (SepoliaETH)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" min="0.000001" step="0.001" /></label><label>Unlock after<input type="datetime-local" value={unlockAt} onChange={(event) => setUnlockAt(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !data.enabled} onClick={() => void postBond()}>{busy ? 'Waiting for wallet…' : 'Lock operator bond'}</button>{!data.enabled && <small>Configure BOA_CONTRACT_ADDRESS to enable vault transactions.</small>}</div>}
      {data.bond && <div className="boa-status"><span>Locked bond <b>{data.bond.amountWei} wei</b></span><span>Operator <b>{data.bond.operator}</b></span><span>Unlocks <b>{new Date(data.bond.unlockAt).toLocaleDateString()}</b></span></div>}
      <div className="boa-milestones">{data.milestones.map((milestone) => <div className="boa-milestone" key={milestone.id}><span><b>{milestone.title}</b><small>{milestone.status}{milestone.evidenceReference ? ` · ${milestone.evidenceReference}` : ''}</small></span>{isOwner && ['pending', 'rejected'].includes(milestone.status) && <button className="text-link" disabled={busy} onClick={() => void submitMilestone(milestone)}>Submit evidence</button>}{canVerify && milestone.status === 'submitted' && <span><button className="text-link" disabled={busy} onClick={() => void reviewMilestone(milestone, 'approve')}>Approve</button><button className="text-link" disabled={busy} onClick={() => void reviewMilestone(milestone, 'reject')}>Reject</button></span>}</div>)}</div>
    </>}
  </details>
}

function ActivityPage({ activity, onCopy }: { activity: AppState['activity']; onCopy: (text: string) => void }) {
  return <div className="page-stack"><section className="panel list-page-panel"><div className="panel-heading"><div><span className="section-kicker">TRANSPARENT BY DEFAULT</span><h2>Activity & audit trail</h2><p>Application events are shown separately from any simulated chain references.</p></div><button className="button button-outline" onClick={() => onCopy(JSON.stringify(activity, null, 2))}><Download size={15} /> Copy report</button></div><div className="timeline-list">{activity.map((event, index) => <div className="timeline-item" key={`${event.title}-${index}`}><span className={`timeline-node ${index === 0 ? 'latest' : ''}`}><Activity size={14} /></span><div><b>{event.title}</b><p>{event.detail}</p><small>{event.time} · Wallet account event</small></div><button className="icon-button tiny" aria-label="Copy event" onClick={() => onCopy(`${event.title} — ${event.detail}`)}><Copy size={14} /></button></div>)}{activity.length === 0 && <div className="empty-state"><ClipboardCheck size={25} /><h3>No activity yet</h3><p>Actions you take will appear here.</p></div>}</div><div className="audit-legend"><span><i className="legend-dot app-event" /> Application event</span><span><i className="legend-dot chain-event" /> Chain data: not connected</span></div></section></div>
}

function SettingsPage({ role, username, authMode, walletConnected, walletAddress, walletChainId, configuredChainId, contractAddress, walletProviders, selectedWalletId, apiBusy, onChangeRole, setSelectedWalletId, onRefreshWallets, onLinkWallet, theme, setTheme, onCopy, onSignOut, onRequestRemove, onStartTour, onReset }: {
  role: Role
  username: string
  authMode: 'password' | 'wallet'
  walletConnected: boolean
  walletAddress: string
  walletChainId: number | null
  configuredChainId: number | null
  contractAddress: string | null
  walletProviders: EvmWalletInfo[]
  selectedWalletId: string
  apiBusy: boolean
  onChangeRole: (role: MarketplaceRole) => void
  setSelectedWalletId: (id: string) => void
  onRefreshWallets: () => void
  onLinkWallet: () => void
  theme: 'light' | 'dark'
  setTheme: (value: 'light' | 'dark') => void
  onCopy: (value: string) => void
  onSignOut: () => void
  onRequestRemove: () => void
  onStartTour: () => void
  onReset: () => void
}) {
  const editableRole: Partial<Record<Role, MarketplaceRole>> = {
    'Energy Producer': 'prosumer',
    'Energy Consumer': 'consumer',
    'Producer & Consumer': 'both',
    Investor: 'funder',
  }
  const selectedMarketplaceRole = editableRole[role]
  return (
    <div className="page-stack settings-grid">
      <section className="panel settings-card">
        <span className="settings-icon"><Wallet size={18} /></span>
        <div>
          <span className="section-kicker">ACCOUNT</span>
          <h2>Profile & role</h2>
          <p>{authMode === 'password' ? 'Your account uses username and password authentication. Link an EVM wallet to unlock wallet-dependent marketplace and blockchain actions.' : 'Your account is authenticated by your EVM wallet. Verifier and administrator access is assigned only by an operator allowlist.'}</p>
          {selectedMarketplaceRole
            ? <label className="settings-field">Participation role<select value={selectedMarketplaceRole} disabled={apiBusy} onChange={(event) => onChangeRole(event.target.value as MarketplaceRole)}><option value="prosumer">Energy Producer · offer energy</option><option value="consumer">Energy Consumer · request energy</option><option value="both">Producer & Consumer · offer and request</option><option value="funder">Investor · register non-cash project interest</option></select></label>
            : <div className="settings-field">Platform role <b>{role} · operator managed</b></div>}
          {username && <div className="settings-field">Username <b>@{username}</b></div>}
          <div className="settings-note"><CircleHelp size={15} /> {walletConnected ? 'An EVM wallet is linked after signature verification. Bright Ledger never receives its private key.' : 'No wallet is linked. Wallet-dependent listings, trades, and blockchain actions remain unavailable until you link one.'}</div>
          {!walletConnected && <div className="web3-profile">
            <label>Browser EVM wallet<select value={selectedWalletId} onChange={(event) => setSelectedWalletId(event.target.value)} disabled={walletProviders.length === 0}>
              {walletProviders.length === 0 && <option value="">No wallet detected</option>}
              {walletProviders.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </select></label>
            <div className="web3-profile-actions"><button className="button button-outline" type="button" onClick={onRefreshWallets}>Refresh wallet list</button><button className="button button-primary" type="button" disabled={apiBusy || walletProviders.length === 0} onClick={onLinkWallet}>{apiBusy ? 'Waiting for wallet…' : 'Link wallet by signature'}</button></div>
            <small>Supports browser-injected EVM wallets. Phantom’s EVM mode may work; Solana-only Phantom and mobile deep links are not supported.</small>
          </div>}
          {walletConnected && <div className="web3-profile">
            <label>Active browser wallet<select value={selectedWalletId} onChange={(event) => setSelectedWalletId(event.target.value)} disabled={walletProviders.length === 0}>
              {walletProviders.length === 0 && <option value="">No wallet detected</option>}
              {walletProviders.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </select></label>
            <button className="button button-outline" type="button" onClick={onRefreshWallets}>Refresh wallet list</button>
            <div><span>Wallet address</span><code>{walletAddress}</code><button className="text-link" onClick={() => onCopy(walletAddress)}><Copy size={13} /> Copy address</button></div>
            <div><span>Active network</span><b>{walletChainId === null ? 'Unavailable' : `${evmNetworkName(walletChainId)} · ${walletChainId}`}</b></div>
            <div><span>On-chain actions</span><b>{walletChainId !== null && walletChainId === configuredChainId ? 'Contract configured for this network' : 'No matching deployed contract'}</b></div>
            <div><span>Trading contract</span><code>{contractAddress || 'Not configured'}</code>{contractAddress && <button className="text-link" onClick={() => onCopy(contractAddress)}><Copy size={13} /> Copy contract address</button>}</div>
            {explorerAddressUrl(walletChainId, walletAddress) && <a className="text-link" href={explorerAddressUrl(walletChainId, walletAddress)!} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open wallet in block explorer</a>}
            <div className="web3-profile-actions"><button className="button button-outline" onClick={onSignOut}>Sign out</button><button className="button button-danger-outline" onClick={onRequestRemove}>Remove account</button></div>
          </div>}
        </div>
      </section>
      <section className="panel settings-card">
        <span className="settings-icon green-settings"><Sun size={18} /></span>
        <div>
          <span className="section-kicker">PREFERENCES</span>
          <h2>Appearance</h2>
          <p>Choose the look that feels right. Your selection is saved in this browser.</p>
          <div className="theme-selector">
            <button className={theme === 'light' ? 'theme-option active' : 'theme-option'} onClick={() => setTheme('light')}><span className="theme-preview light-preview" />Warm light</button>
            <button className={theme === 'dark' ? 'theme-option active' : 'theme-option'} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview" />Forest night</button>
          </div>
        </div>
      </section>
      <section className="panel settings-card wide-settings">
        <span className="settings-icon"><CircleHelp size={18} /></span>
        <div>
          <span className="section-kicker">GETTING STARTED</span>
          <h2>Guided tour</h2>
          <p>Walk through offers, requests, trade records, evidence, and community solar again.</p>
          <button className="button button-outline" onClick={onStartTour}>Start guided tour <ArrowRight size={14} /></button>
        </div>
      </section>
      <section className="panel settings-card wide-settings">
        <span className="settings-icon gold-settings"><ShieldCheck size={18} /></span>
        <div>
          <span className="section-kicker">SERVER DATA</span>
          <h2>Refresh shared records</h2>
          <p>Reload account-scoped records and notifications from the PostgreSQL-backed API.</p>
          <button className="button button-danger-outline" onClick={onReset}>Refresh from server</button>
        </div>
      </section>
      <div className="helper-note wide-settings"><ShieldCheck size={16} /><span>Keep verifier and administrator roles operator-managed. Energy readings and points are illustrative, not proof of physical delivery.</span></div>
    </div>
  )
}

function Modal({ kind, onClose, onListing, onProject, onEstimateProject, onMatch, onFund, onEvidenceSubmit, onEvidenceAIReview, onEvidenceFileChange, aiEvidenceReview, aiEvidenceLoading, listing, project, evidence, role, chainPaymentsEnabled, onReview, onSettle, trade }: {
  kind: 'listing' | 'project' | 'match' | 'fund' | 'evidence'
  onClose: () => void
  onListing: (event: React.FormEvent<HTMLFormElement>) => void
  onProject: (event: React.FormEvent<HTMLFormElement>) => void
  onEstimateProject: (input: ProjectFundingEstimateInput) => Promise<ProjectFundingEstimate>
  onMatch: (event: React.FormEvent<HTMLFormElement>) => void
  onFund: (event: React.FormEvent<HTMLFormElement>) => void
  onEvidenceSubmit: (event: React.FormEvent<HTMLFormElement>, trade: Trade) => void
  onEvidenceAIReview: (file: File, consent: boolean) => void
  onEvidenceFileChange: () => void
  aiEvidenceReview: EvidenceAiReview | null
  aiEvidenceLoading: boolean
  listing: Listing | null
  project: Project | null
  evidence: Evidence | null
  role: Role
  chainPaymentsEnabled: boolean
  onReview: (item: Evidence, decision: 'Approved' | 'Rejected') => void
  onSettle: (trade: Trade) => void
  trade?: Trade
}) {
  const [fundingEstimate, setFundingEstimate] = useState<ProjectFundingEstimate | null>(null)
  const [fundingEstimateBusy, setFundingEstimateBusy] = useState(false)
  const [fundingEstimateError, setFundingEstimateError] = useState('')
  const heading = kind === 'listing' ? 'Create an energy listing' : kind === 'project' ? 'Create a solar fundraiser' : kind === 'match' ? listing?.type === 'request' ? 'Review request match proposal' : 'Review match proposal' : kind === 'fund' ? 'Register investor interest' : 'Evidence review'
  const subheading = kind === 'listing' ? 'Share energy with your local microgrid.' : kind === 'project' ? 'Present a project site and a cost-based funding goal.' : kind === 'match' ? 'Check the terms before confirming a match.' : kind === 'fund' ? 'This records non-cash interest only; no investment or payment occurs.' : 'Inspect the submitted reading and its verification state.'
  function requestAiReview(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    const fileInput = form?.querySelector<HTMLInputElement>('input[name="evidenceFile"]')
    const file = fileInput?.files?.[0]
    if (!file) {
      fileInput?.focus()
      return
    }
    const consent = form?.querySelector<HTMLInputElement>('input[name="aiConsent"]')?.checked ?? false
    onEvidenceAIReview(file, consent)
  }
  async function requestProjectEstimate(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    if (!form) return
    const consent = form.elements.namedItem('fundingAiConsent')
    const consentToAi = consent instanceof HTMLInputElement && consent.checked
    const values = new FormData(form)
    const input: ProjectFundingEstimateInput = {
      location: String(values.get('location') ?? ''),
      siteType: String(values.get('siteType') ?? ''),
      usableAreaM2: Number(values.get('area')),
      costs: {
        equipmentUsd: Number(values.get('equipmentUsd')),
        installationUsd: Number(values.get('installationUsd')),
        permittingUsd: Number(values.get('permittingUsd')),
        interconnectionUsd: Number(values.get('interconnectionUsd')),
        otherUsd: Number(values.get('otherUsd')),
      },
      contingencyPercent: Number(values.get('contingencyPercent')),
      revenueShares: {
        owner: Number(values.get('ownerShare')),
        funder: Number(values.get('funderShare')),
        community: Number(values.get('communityShare')),
      },
      consentToAi,
    }
    setFundingEstimateBusy(true)
    setFundingEstimateError('')
    setFundingEstimate(null)
    try {
      const result = await onEstimateProject(input)
      setFundingEstimate(result)
      const target = form.elements.namedItem('target')
      const estimateId = form.elements.namedItem('fundingEstimateId')
      if (target instanceof HTMLInputElement) {
        target.value = result.requiredFundingUsd.toFixed(2)
        target.readOnly = true
      }
      if (estimateId instanceof HTMLInputElement) estimateId.value = result.id
    } catch (error) {
      setFundingEstimateError(error instanceof Error ? error.message : 'The funding estimate could not be completed.')
    } finally {
      setFundingEstimateBusy(false)
    }
  }
  function invalidateFundingEstimate(event: React.FormEvent<HTMLFormElement>) {
    const changedField = event.target
    if (!(changedField instanceof HTMLInputElement || changedField instanceof HTMLSelectElement)) return
    const estimateFields = new Set(['location', 'siteType', 'area', 'equipmentUsd', 'installationUsd', 'permittingUsd', 'interconnectionUsd', 'otherUsd', 'contingencyPercent', 'ownerShare', 'funderShare', 'communityShare'])
    if (!estimateFields.has(changedField.name)) return
    setFundingEstimate(null)
    setFundingEstimateError('')
    const estimateId = event.currentTarget.elements.namedItem('fundingEstimateId')
    if (estimateId instanceof HTMLInputElement) estimateId.value = ''
    const target = event.currentTarget.elements.namedItem('target')
    if (target instanceof HTMLInputElement) target.readOnly = false
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">BRIGHT LEDGER</span><h2 id="modal-title">{heading}</h2><p>{subheading}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
    {kind === 'listing' && <form className="modal-form" onSubmit={onListing}><label>Listing type<select name="type" defaultValue={role === 'Energy Consumer' ? 'request' : 'offer'}><option value="offer">Energy offer · I produce energy to share</option><option value="request">Energy request · I want to buy energy</option></select></label><div className="form-row"><label>Energy quantity<input name="quantity" type="number" min="0.1" max="10000" step="0.1" placeholder="e.g. 8.5" required /><small>kWh</small></label><label>Price per kWh<input name="price" type="number" min="0.0001" max="1000" step="0.0001" placeholder="Enter USD/kWh" required /><small>Set the price you want to offer or are willing to pay; Bright Ledger does not calculate or recommend a rate.</small></label></div><div className="form-row"><label>Microgrid / area<input name="area" placeholder="City, country" required /></label><label>Renewable source<select name="source"><option>Rooftop solar</option><option>Solar + storage</option><option>Community solar</option><option>Any renewable</option></select></label></div><label>Delivery window<select name="window"><option>Today, 2:00–6:00 PM</option><option>Today, 4:00–8:00 PM</option><option>Tomorrow, 9:00 AM</option></select></label><div className="modal-disclosure"><ShieldCheck size={15} /> Listings are saved to the shared Bright Ledger database.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Publish listing <ArrowRight size={15} /></button></div></form>}
    {kind === 'project' && <form className="modal-form" onSubmit={onProject} onChange={invalidateFundingEstimate}>
      <label>Project / site name<input name="name" placeholder="Use a fictional prototype name" required /></label>
      <div className="form-row"><label>Approximate location<input name="location" placeholder="City, country only" required /><small>Do not enter a street address. This location is shared with the AI provider only after consent.</small></label><label>Site type<select name="siteType"><option>Residential rooftop</option><option>Shared rooftop</option><option>Community facility</option><option>Commercial rooftop</option><option>Open land</option></select></label></div>
      <div className="form-row"><label>Usable area<input name="area" type="number" min="10" max="100000" step="1" placeholder="Enter site area" required /><small>m² · approximate</small></label><label>Required funding target<input name="target" type="number" min="0.01" max="100000000" step="0.01" placeholder="Run the estimate or enter a target" required /><small>USD · planning estimate, not a financial offer</small></label></div>
      <div className="funding-planner-fields"><span className="section-kicker">COST ASSUMPTIONS · USD</span><p>Enter current estimates or quotes; the funding total is calculated from these inputs plus contingency.</p>
        <div className="form-row"><label>Equipment<input name="equipmentUsd" type="number" min="0" step="0.01" placeholder="Panels, inverter, storage" required /></label><label>Installation<input name="installationUsd" type="number" min="0" step="0.01" placeholder="Labor and installation" required /></label></div>
        <div className="form-row"><label>Permitting<input name="permittingUsd" type="number" min="0" step="0.01" placeholder="Permits and inspection" required /></label><label>Grid interconnection<input name="interconnectionUsd" type="number" min="0" step="0.01" placeholder="Connection and metering" required /></label></div>
        <div className="form-row"><label>Other project costs<input name="otherUsd" type="number" min="0" step="0.01" placeholder="Additional documented costs" required /></label><label>Contingency<input name="contingencyPercent" type="number" min="0" max="25" step="1" placeholder="0–25%" required /><small>Percent of entered direct costs.</small></label></div>
      </div>
      <div className="form-row revenue-share-inputs"><label>Project Owner share<input name="ownerShare" type="number" min="0" max="100" step="1" placeholder="%" required /></label><label>Investor share<input name="funderShare" type="number" min="0" max="100" step="1" placeholder="%" required /></label><label>Community share<input name="communityShare" type="number" min="0" max="100" step="1" placeholder="%" required /></label></div>
      <label>Permission status<select name="permission"><option>Owner permission stated</option><option>Permission pending review</option><option>Shared community space</option></select></label>
      <label>Site notes<textarea name="notes" rows={2} placeholder="Optional non-sensitive context." /></label>
      <label className="ai-consent"><input name="fundingAiConsent" type="checkbox" /> Optional: send the approximate location, site type, area, cost inputs and proposed revenue shares to OpenRouter for an advisory AI assessment. If unchecked, only the cost estimate is calculated and the project is still sent for human review. Do not include personal or confidential data.</label>
      <input type="hidden" name="fundingEstimateId" />
      <button type="button" className="button button-secondary" onClick={(event) => { void requestProjectEstimate(event) }} disabled={fundingEstimateBusy}>{fundingEstimateBusy ? 'Calculating project estimate…' : 'Calculate funding estimate'} <TrendingUp size={15} /></button>
      {fundingEstimateError && <p className="funding-estimate-error" role="alert">{fundingEstimateError}</p>}
      {fundingEstimate && <div className="funding-estimate-result" role="status"><div className="funding-estimate-total"><span>Required funding from your cost inputs</span><b>{formatUSD(fundingEstimate.requiredFundingUsd)}</b><small>Capacity estimate: {fundingEstimate.capacityKwp} kWp · user-entered cost basis · not a supplier quote</small></div>
        <ul>{fundingEstimate.costBreakdown.map((item) => <li key={item.category}><span>{item.category}</span><b>{formatUSD(item.amountMinor / 100)}</b></li>)}<li><span>Contingency</span><b>{formatUSD(fundingEstimate.contingencyMinor / 100)}</b></li></ul>
        <p><b>{fundingEstimate.aiReview.model === 'Not requested' ? 'Human review note' : `AI project assessment · ${fundingEstimate.aiReview.confidence} confidence · advisory only`}</b><br />{fundingEstimate.aiReview.summary}</p>
        {fundingEstimate.aiReview.flags.length > 0 && <div><b>Assumptions to check</b><ul>{fundingEstimate.aiReview.flags.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        {fundingEstimate.aiReview.suggestedChecks.length > 0 && <div><b>Suggested verification</b><ul>{fundingEstimate.aiReview.suggestedChecks.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        <div className="funding-share-suggestion"><span>AI-proposed revenue allocation · advisory only</span><b>Project Owner {fundingEstimate.aiReview.suggestedRevenueShares.owner}% · Investor {fundingEstimate.aiReview.suggestedRevenueShares.funder}% · Community {fundingEstimate.aiReview.suggestedRevenueShares.community}%</b><button type="button" className="text-link" onClick={(event) => { const form = event.currentTarget.form; if (!form) return; const shares = fundingEstimate.aiReview.suggestedRevenueShares; for (const [name, value] of Object.entries({ ownerShare: shares.owner, funderShare: shares.funder, communityShare: shares.community })) { const field = form.elements.namedItem(name); if (field instanceof HTMLInputElement) field.value = String(value) } }}>Apply suggested allocation</button></div>
        <small>{fundingEstimate.aiReview.model} · review the assumptions and choose all shares yourself before publishing.</small>
      </div>}
      <div className="modal-disclosure"><ShieldCheck size={15} /> Funding estimates use your cost inputs. Investor interest is a simulated record: no money is collected, invested, or distributed. New sites require human review.</div>
      <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Submit fundraiser for review <ArrowRight size={15} /></button></div>
    </form>}
    {kind === 'match' && listing && <form className="modal-form" onSubmit={onMatch}><div className="match-summary"><div className="listing-avatar">{listing.owner.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><b>{listing.owner}</b><span>{listing.area} · {listing.source}</span></div><Status status="Open" /></div><div className="match-term-row"><span>Available energy</span><b>{listing.quantity} kWh</b></div><div className="match-term-row"><span>Agreed unit price</span><b>${listing.price.toFixed(2)} / kWh</b></div><label>Quantity to request<input name="quantity" type="number" min="0.1" max={listing.quantity} step="0.1" defaultValue={Math.min(5, listing.quantity)} required /><small>Cannot exceed the available listing quantity.</small></label><div className="match-estimate"><span>Illustrative total · not a payment</span><b>${(listing.price * Math.min(5, listing.quantity)).toFixed(2)}</b></div><div className="modal-disclosure"><ShieldCheck size={15} /> A match reserves listing quantity. No payment or electricity delivery occurs.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">{listing.type === 'offer' ? 'Request match' : 'Propose match'} <ArrowRight size={15} /></button></div></form>}
    {kind === 'fund' && project && <form className="modal-form" onSubmit={onFund}><div className="fund-project-summary"><div className="project-mini-sun"><Sun size={22} /></div><div><b>{project.name}</b><span>{project.location}</span></div></div><div className="fund-progress-line"><span>Recorded contribution interest</span><b>{pct(project.raised, project.target)}%</b></div><div className="progress-track"><i style={{ width: `${pct(project.raised, project.target)}%` }} /></div><div className="funding-amount"><span>{formatUSD(project.raised)} <small>recorded</small></span><span>{formatUSD(project.target - project.raised)} <small>goal remaining</small></span></div><label>Proposed contribution amount<input name="amount" type="number" min="1" max={project.target - project.raised} step="1" placeholder="e.g. 250" required /><small>USD · recorded as simulated non-cash interest; no payment is made</small></label><div className="modal-disclosure"><ShieldCheck size={15} /> This is not an investment, payment, or promise of financial return.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Register interest <ArrowRight size={15} /></button></div></form>}
    {kind === 'evidence' && !evidence && trade && <form className="modal-form" onSubmit={(event) => onEvidenceSubmit(event, trade)}><div className="match-summary"><div className="listing-avatar"><Sun size={15} /></div><div><b>{trade.id} · {trade.quantity} kWh</b><span>Delivery evidence for {trade.seller}</span></div><Status status={trade.status} /></div><label>Reported energy delivered<input name="quantity" type="number" min="0.1" max={trade.quantity} step="0.1" defaultValue={trade.quantity} required /><small>kWh · cannot exceed the committed trade quantity</small></label><div className="form-row"><label>Evidence source<input name="source" maxLength={120} placeholder="Meter, inverter, manual reading source" required /></label><label>Reading interval<select name="interval"><option>Current reading interval</option><option>Previous reading interval</option></select></label></div><label>Meter or inverter evidence<input name="evidenceFile" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,image/jpeg,image/png,image/webp,application/pdf,text/csv" onChange={onEvidenceFileChange} /><small>JPEG, PNG, WebP, PDF or UTF-8 CSV · maximum 8 MB · stored with this PostgreSQL record and available only to trade participants and authorized verifiers.</small></label><label className="ai-consent"><input name="aiConsent" type="checkbox" /> I consent to sending this file to OpenRouter for advisory AI analysis. Provider data-handling policies apply.</label><div className="ai-review-controls"><button type="button" className="button button-secondary" onClick={requestAiReview} disabled={aiEvidenceLoading}>{aiEvidenceLoading ? 'Checking evidence…' : 'Run AI evidence check'} <ShieldCheck size={15} /></button><span>Advisory only · never auto-approved</span></div>{aiEvidenceReview && <div className="ai-review-result" role="status"><b>AI triage · {aiEvidenceReview.analysis.confidence} confidence</b><p>{aiEvidenceReview.analysis.summary}</p>{aiEvidenceReview.analysis.flags.length > 0 && <div><span>Potential issues to inspect</span><ul>{aiEvidenceReview.analysis.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}<div><span>Suggested human checks</span><ul>{aiEvidenceReview.analysis.suggestedChecks.map((check) => <li key={check}>{check}</li>)}</ul></div><small>Model: {aiEvidenceReview.model} · File SHA-256: {aiEvidenceReview.fileSha256} · Review is not proof of authenticity, generation, or delivery.</small></div>}    <div className="modal-disclosure"><ShieldCheck size={15} /> The file is stored in the app database on submission. It is sent to OpenRouter only when you request AI review and consent. The buyer reviews delivery evidence; verifiers resolve disputes.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Submit delivery evidence <ArrowRight size={15} /></button></div></form>}
    {kind === 'evidence' && evidence && <div className="modal-form">
      <div className="evidence-detail-callout"><ShieldCheck size={20} /><span><b>{evidence.id} · {evidence.source}</b><small>Reading record · not independently verified</small></span><Status status={evidence.status} /></div>
      <div className="match-term-row"><span>Linked trade</span><b>{evidence.trade}</b></div>
      <div className="match-term-row"><span>Reported generation</span><b>{evidence.quantity} kWh</b></div>
      <div className="match-term-row"><span>Interval</span><b>{evidence.interval}</b></div>
      <div className="match-term-row"><span>Evidence context</span><b>{evidence.project}</b></div>
      {evidence.reference && <div className="match-term-row"><span>Evidence reference</span><b>{evidence.reference}</b></div>}
      {evidence.evidenceFileSha256 && <div className="evidence-file-hash">File SHA-256: <code>{evidence.evidenceFileSha256}</code></div>}
      {evidence.reason && <div className="rejection-reason">{evidence.status === 'Disputed' ? 'Buyer dispute reason' : 'Review note'}: {evidence.reason}</div>}
      {evidence.aiReview && <div className="ai-review-result"><b>AI advisory review · {evidence.aiReview.analysis.confidence} confidence</b><p>{evidence.aiReview.analysis.summary}</p>{evidence.aiReview.analysis.flags.length > 0 && <div><span>Potential issues to inspect</span><ul>{evidence.aiReview.analysis.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}<div><span>Suggested human checks</span><ul>{evidence.aiReview.analysis.suggestedChecks.map((check) => <li key={check}>{check}</li>)}</ul></div><small>{evidence.aiReview.model} · advisory only · review ID {evidence.aiReview.id}</small></div>}
      <div className="match-term-row"><span>Review state</span><b className="provenance"><ShieldCheck size={14} /> {evidence.status === 'Approved' ? trade?.status === 'Settled' ? 'Trade complete · buyer approved delivery' : 'Buyer approved delivery' : evidence.status === 'Rejected' ? 'Dispute resolved for buyer' : evidence.status === 'Disputed' ? 'Dispute open · escrow remains locked' : 'Awaiting buyer review'}</b></div>
      <div className="modal-disclosure">{evidence.status === 'Disputed'
        ? chainPaymentsEnabled ? 'An authorized verifier resolves the appeal by releasing escrow to the seller or refunding it to the buyer.' : 'An authorized verifier resolves the appeal for the buyer or seller. This deployment does not move funds.'
        : chainPaymentsEnabled ? 'The seller submits delivery evidence. The buyer approves it to release escrow and complete the trade, or opens a dispute. Evidence upload itself never moves funds.' : 'The seller submits delivery evidence. The buyer approves it to complete the trade or opens a dispute. Approval updates the shared record; no money moves.'}</div>
      <div className="modal-actions">
        {evidence.status === 'Pending' && evidence.buyerCanReview && <><button className="button button-danger-outline" onClick={() => onReview(evidence, 'Rejected')}>Open dispute</button><button className="button button-approve" onClick={() => onReview(evidence, 'Approved')}><Check size={15} /> {chainPaymentsEnabled ? 'Approve & release escrow' : 'Approve delivery'}</button></>}
        {evidence.status === 'Pending' && !evidence.buyerCanReview && <span className="permission-note"><ShieldCheck size={14} /> Waiting for the buyer to review</span>}
        {evidence.status === 'Disputed' && (role === 'Verifier' || role === 'Admin') && <><button className="button button-danger-outline" onClick={() => onReview(evidence, 'Rejected')}>{chainPaymentsEnabled ? 'Refund buyer' : 'Resolve for buyer'}</button><button className="button button-approve" onClick={() => onReview(evidence, 'Approved')}><Check size={15} /> {chainPaymentsEnabled ? 'Release to seller' : 'Resolve for seller'}</button></>}
        {evidence.status === 'Approved' && trade?.status === 'Ready to settle' && <button className="button button-primary" onClick={() => { onSettle(trade); onClose() }}>Complete trade <ArrowRight size={14} /></button>}
        {(evidence.status === 'Rejected' || (evidence.status === 'Disputed' && role !== 'Verifier' && role !== 'Admin') || (evidence.status === 'Approved' && trade?.status !== 'Ready to settle')) && <button className="button button-outline" onClick={onClose}>Close</button>}
      </div>
    </div>}
    </div></div>
}

export default App
