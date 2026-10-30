export function calculateSimulatedIncomeAllocations(amountMinor, shares, ownerName, investors) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw new RangeError('Simulated income must be a positive amount of USD cents.');
    }
    const percentages = [shares.owner, shares.funder, shares.community];
    if (percentages.some((share) => !Number.isInteger(share) || share < 0 || share > 100) ||
        percentages.reduce((sum, share) => sum + share, 0) !== 100) {
        throw new RangeError('Project revenue shares must be whole percentages that total 100.');
    }
    const shareAmounts = [
        { type: 'owner', base: Math.floor(amountMinor * shares.owner / 100), remainder: amountMinor * shares.owner % 100 },
        { type: 'investor', base: Math.floor(amountMinor * shares.funder / 100), remainder: amountMinor * shares.funder % 100 },
        { type: 'community', base: Math.floor(amountMinor * shares.community / 100), remainder: amountMinor * shares.community % 100 },
    ];
    let remainingShareCents = amountMinor - shareAmounts.reduce((sum, share) => sum + share.base, 0);
    const shareRemainderOrder = [...shareAmounts].sort((a, b) => b.remainder - a.remainder || ['owner', 'investor', 'community'].indexOf(a.type) - ['owner', 'investor', 'community'].indexOf(b.type));
    const roundedShareAmounts = new Map(shareAmounts.map((share) => [share.type, share.base]));
    for (let index = 0; remainingShareCents > 0; index += 1, remainingShareCents -= 1) {
        const share = shareRemainderOrder[index];
        roundedShareAmounts.set(share.type, roundedShareAmounts.get(share.type) + 1);
    }
    const ownerAmount = roundedShareAmounts.get('owner');
    const investorAmount = roundedShareAmounts.get('investor');
    const communityAmount = roundedShareAmounts.get('community');
    const allocations = [];
    if (ownerAmount > 0)
        allocations.push({ recipient: ownerName, type: 'owner', amountMinor: ownerAmount });
    if (investorAmount > 0) {
        const eligibleInvestors = investors.filter((investor) => Number.isSafeInteger(investor.amountMinor) && investor.amountMinor > 0);
        const totalInvested = eligibleInvestors.reduce((sum, investor) => sum + BigInt(investor.amountMinor), 0n);
        if (totalInvested === 0n) {
            allocations.push({ recipient: 'Investor pool (unallocated)', type: 'investor', amountMinor: investorAmount });
        }
        else {
            const sharesByInvestor = eligibleInvestors.map((investor) => {
                const numerator = BigInt(investorAmount) * BigInt(investor.amountMinor);
                return {
                    investor,
                    amountMinor: Number(numerator / totalInvested),
                    remainder: numerator % totalInvested,
                };
            });
            let remainingCents = investorAmount - sharesByInvestor.reduce((sum, item) => sum + item.amountMinor, 0);
            const remainderOrder = [...sharesByInvestor].sort((a, b) => a.remainder === b.remainder
                ? a.investor.id.localeCompare(b.investor.id)
                : a.remainder > b.remainder ? -1 : 1);
            for (let index = 0; remainingCents > 0; index += 1, remainingCents -= 1) {
                remainderOrder[index].amountMinor += 1;
            }
            for (const item of sharesByInvestor) {
                if (item.amountMinor > 0) {
                    allocations.push({ recipient: item.investor.name, type: 'investor', amountMinor: item.amountMinor });
                }
            }
        }
    }
    if (communityAmount > 0) {
        allocations.push({ recipient: 'Community allocation', type: 'community', amountMinor: communityAmount });
    }
    return allocations;
}
