// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Stores auditable P2P energy-trade commitments. No electricity or funds move.
contract EnergyTrading {
    enum Status { None, Committed, EvidenceSubmitted, EvidenceApproved, Disputed, Settled }

    struct Trade {
        address buyer;
        address seller;
        uint64 energyWh;
        uint128 pricePerKWhScaled;
        Status status;
        bytes32 evidenceHash;
    }

    address public owner;
    mapping(address => bool) public verifiers;
    mapping(bytes32 => Trade) private trades;
    mapping(address => uint256) public demoPoints;

    error Unauthorized();
    error InvalidTrade();
    error InvalidState();
    error DuplicateTrade();

    event VerifierUpdated(address indexed account, bool enabled);
    event TradeCommitted(bytes32 indexed tradeId, address indexed buyer, address indexed seller, uint64 energyWh, uint128 pricePerKWhScaled);
    event EvidenceSubmitted(bytes32 indexed tradeId, bytes32 evidenceHash);
    event EvidenceReviewed(bytes32 indexed tradeId, bool approved, bytes32 reasonHash);
    event TradeSettled(bytes32 indexed tradeId, address indexed buyer, address indexed seller, uint64 energyWh, uint256 buyerPoints, uint256 sellerPoints);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidTrade();
        owner = initialOwner;
        verifiers[initialOwner] = true;
        emit VerifierUpdated(initialOwner, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setVerifier(address account, bool enabled) external onlyOwner {
        if (account == address(0)) revert InvalidTrade();
        verifiers[account] = enabled;
        emit VerifierUpdated(account, enabled);
    }

    function commitTrade(
        bytes32 tradeId,
        address buyer,
        address seller,
        uint64 energyWh,
        uint128 pricePerKWhScaled
    ) external {
        if (
            tradeId == bytes32(0) || buyer == address(0) || seller == address(0) ||
            buyer == seller || energyWh == 0 || pricePerKWhScaled == 0 ||
            (msg.sender != buyer && msg.sender != seller)
        ) revert InvalidTrade();
        if (trades[tradeId].status != Status.None) revert DuplicateTrade();
        trades[tradeId] = Trade(buyer, seller, energyWh, pricePerKWhScaled, Status.Committed, bytes32(0));
        emit TradeCommitted(tradeId, buyer, seller, energyWh, pricePerKWhScaled);
    }

    function submitEvidence(bytes32 tradeId, bytes32 evidenceHash) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Committed && trade.status != Status.Disputed) revert InvalidState();
        if (msg.sender != trade.seller || evidenceHash == bytes32(0)) revert Unauthorized();
        trade.evidenceHash = evidenceHash;
        trade.status = Status.EvidenceSubmitted;
        emit EvidenceSubmitted(tradeId, evidenceHash);
    }

    function reviewEvidence(bytes32 tradeId, bool approved, bytes32 reasonHash) external {
        Trade storage trade = trades[tradeId];
        if (!verifiers[msg.sender]) revert Unauthorized();
        if (trade.status != Status.EvidenceSubmitted) revert InvalidState();
        if (msg.sender == trade.seller) revert Unauthorized();
        trade.status = approved ? Status.EvidenceApproved : Status.Disputed;
        emit EvidenceReviewed(tradeId, approved, reasonHash);
    }

    function settleTrade(bytes32 tradeId) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.EvidenceApproved) revert InvalidState();
        if (msg.sender != trade.buyer && msg.sender != trade.seller) revert Unauthorized();
        trade.status = Status.Settled;
        uint256 points = uint256(trade.energyWh) / 100;
        if (points == 0) points = 1;
        demoPoints[trade.seller] += points;
        demoPoints[trade.buyer] += points;
        emit TradeSettled(tradeId, trade.buyer, trade.seller, trade.energyWh, points, points);
    }

    function getTrade(bytes32 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
}
