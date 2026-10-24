export const walletRoles = ['prosumer', 'consumer', 'both', 'funder'];
function configuredWallets(value) {
    return new Set((value ?? '').split(',').map((address) => address.trim().toLowerCase()).filter(Boolean));
}
export function trustedRoleForWallet(address, requestedRole, environment = process.env) {
    const normalizedAddress = address.toLowerCase();
    if (configuredWallets(environment.ADMIN_WALLET_ADDRESSES).has(normalizedAddress))
        return 'admin';
    if (configuredWallets(environment.VERIFIER_WALLET_ADDRESSES).has(normalizedAddress))
        return 'verifier';
    if (configuredWallets(environment.SPACE_OWNER_WALLET_ADDRESSES).has(normalizedAddress))
        return 'space_owner';
    return requestedRole;
}
