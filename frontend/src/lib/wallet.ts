export type EvmWalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
}

export type EvmWalletInfo = {
  id: string
  name: string
  provider: EvmWalletProvider
}

declare global {
  interface Window {
    ethereum?: EvmWalletProvider & { providers?: EvmWalletProvider[] }
  }
}

let availableWallets: EvmWalletInfo[] = []
let activeWalletId = ''

function providerIdentity(provider: EvmWalletProvider, fallbackIndex: number): EvmWalletInfo {
  const announced = provider as EvmWalletProvider & { __brightLedgerInfo?: { uuid?: string; name?: string } }
  return {
    id: announced.__brightLedgerInfo?.uuid ?? `injected-${fallbackIndex}`,
    name: announced.__brightLedgerInfo?.name ?? `Browser EVM wallet ${fallbackIndex + 1}`,
    provider,
  }
}

export async function discoverEvmWallets(): Promise<EvmWalletInfo[]> {
  const announced = new Map<string, EvmWalletInfo>()
  const handleAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<{ info?: { uuid?: string; name?: string }; provider?: EvmWalletProvider }>).detail
    if (!detail?.provider || !detail.info?.uuid || !detail.info.name) return
    const provider = Object.assign(detail.provider, { __brightLedgerInfo: detail.info })
    announced.set(detail.info.uuid, { id: detail.info.uuid, name: detail.info.name, provider })
  }
  window.addEventListener('eip6963:announceProvider', handleAnnouncement)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  window.removeEventListener('eip6963:announceProvider', handleAnnouncement)

  for (const [index, provider] of (window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : [])).entries()) {
    if ([...announced.values()].some((wallet) => wallet.provider === provider)) continue
    const info = providerIdentity(provider, index)
    if (!announced.has(info.id)) announced.set(info.id, info)
  }
  availableWallets = [...announced.values()].sort((left, right) => left.name.localeCompare(right.name))
  if (!availableWallets.some((wallet) => wallet.id === activeWalletId)) {
    activeWalletId = availableWallets[0]?.id ?? ''
  }
  return availableWallets
}

export function selectEvmWallet(id: string) {
  if (!availableWallets.some((wallet) => wallet.id === id)) {
    throw new Error('Select an EVM wallet detected in this browser.')
  }
  activeWalletId = id
}

export function getActiveEvmWallet(): EvmWalletProvider | null {
  return availableWallets.find((wallet) => wallet.id === activeWalletId)?.provider ?? window.ethereum ?? null
}
