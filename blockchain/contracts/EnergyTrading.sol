// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPriceFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

/// @notice Records trade commitments and optionally escrows native testnet ETH.
contract EnergyTrading {
    enum Status { None, Committed, EvidenceSubmitted, EvidenceApproved, Disputed, Settled, Refunded }

    struct Trade {
        address buyer;
        address seller;
        uint64 energyWh;
        uint128 pricePerKWhScaled;
        Status status;
        bytes32 evidenceHash;
    }

    address public owner;
    IPriceFeed public immutable ethUsdPriceFeed;
    mapping(address => bool) public verifiers;
    mapping(bytes32 => Trade) private trades;
    mapping(address => uint256) public demoPoints;
    mapping(bytes32 => uint256) public escrowedWei;
    uint256 private constant MAX_TRADE_USD_SCALED = 1_000_000_000_000;
    uint256 private constant USD_TO_WEI_SCALE = 1e22;
    uint256 private constant MAX_PRICE_AGE = 1 hours;

    error Unauthorized();
    error InvalidTrade();
    error InvalidState();
    error DuplicateTrade();
    error InvalidPriceFeed();
    error InvalidPayment();
    error PaymentTransferFailed();

    event VerifierUpdated(address indexed account, bool enabled);
    event TradeCommitted(bytes32 indexed tradeId, address indexed buyer, address indexed seller, uint64 energyWh, uint128 pricePerKWhScaled, uint256 paymentWei);
    event EvidenceSubmitted(bytes32 indexed tradeId, bytes32 evidenceHash);
    event EvidenceReviewed(bytes32 indexed tradeId, bool approved, bytes32 reasonHash);
    event TradeSettled(bytes32 indexed tradeId, address indexed buyer, address indexed seller, uint64 energyWh, uint256 buyerPoints, uint256 sellerPoints);
    event TradePaymentReleased(bytes32 indexed tradeId, address indexed seller, uint256 amountWei);
    event TradePaymentRefunded(bytes32 indexed tradeId, address indexed buyer, uint256 amountWei);

    constructor(address initialOwner, address priceFeed) {
        if (initialOwner == address(0)) revert InvalidTrade();
        owner = initialOwner;
        ethUsdPriceFeed = IPriceFeed(priceFeed);
        verifiers[initialOwner] = true;
        emit VerifierUpdated(initialOwner, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function quotePayment(uint64 energyWh, uint128 pricePerKWhScaled)
        external
        view
        returns (uint256 paymentWei, uint256 ethUsdPrice)
    {
        return _quotePayment(energyWh, pricePerKWhScaled);
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
    ) external payable {
        if (
            tradeId == bytes32(0) || buyer == address(0) || seller == address(0) ||
            buyer == seller || energyWh == 0 || pricePerKWhScaled == 0 ||
            msg.sender != buyer
        ) revert InvalidTrade();
        if (trades[tradeId].status != Status.None) revert DuplicateTrade();
        uint256 paymentWei;
        if (address(ethUsdPriceFeed) == address(0)) {
            if (msg.value != 0) revert InvalidPayment();
        } else {
            (paymentWei,) = _quotePayment(energyWh, pricePerKWhScaled);
            if (msg.value != paymentWei) revert InvalidPayment();
            escrowedWei[tradeId] = paymentWei;
        }
        trades[tradeId] = Trade(buyer, seller, energyWh, pricePerKWhScaled, Status.Committed, bytes32(0));
        emit TradeCommitted(tradeId, buyer, seller, energyWh, pricePerKWhScaled, paymentWei);
    }

    function submitEvidence(bytes32 tradeId, bytes32 evidenceHash) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Committed && trade.status != Status.Disputed) revert InvalidState();
        if (trade.status == Status.Disputed && address(ethUsdPriceFeed) != address(0) && escrowedWei[tradeId] == 0) {
            revert InvalidState();
        }
        if (msg.sender != trade.seller || evidenceHash == bytes32(0)) revert Unauthorized();
        trade.evidenceHash = evidenceHash;
        trade.status = Status.EvidenceSubmitted;
        emit EvidenceSubmitted(tradeId, evidenceHash);
    }

    function approveEvidenceAndSettle(bytes32 tradeId, bytes32 evidenceHash) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Committed || msg.sender != trade.buyer || evidenceHash == bytes32(0)) {
            revert Unauthorized();
        }
        trade.evidenceHash = evidenceHash;
        emit EvidenceSubmitted(tradeId, evidenceHash);
        trade.status = Status.EvidenceApproved;
        emit EvidenceReviewed(tradeId, true, bytes32(0));
        _settle(tradeId, trade);
    }

    function raiseDispute(bytes32 tradeId, bytes32 evidenceHash, bytes32 reasonHash) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Committed || msg.sender != trade.buyer || evidenceHash == bytes32(0)) {
            revert Unauthorized();
        }
        trade.evidenceHash = evidenceHash;
        trade.status = Status.Disputed;
        emit EvidenceSubmitted(tradeId, evidenceHash);
        emit EvidenceReviewed(tradeId, false, reasonHash);
    }

    function resolveDispute(bytes32 tradeId, bool approved, bytes32 reasonHash) external {
        Trade storage trade = trades[tradeId];
        if (!verifiers[msg.sender] || trade.status != Status.Disputed) revert Unauthorized();
        emit EvidenceReviewed(tradeId, approved, reasonHash);
        if (approved) {
            trade.status = Status.EvidenceApproved;
            _settle(tradeId, trade);
            return;
        }
        trade.status = Status.Refunded;
        uint256 refundWei = escrowedWei[tradeId];
        if (refundWei > 0) {
            escrowedWei[tradeId] = 0;
            (bool refunded,) = payable(trade.buyer).call{value: refundWei}('');
            if (!refunded) revert PaymentTransferFailed();
            emit TradePaymentRefunded(tradeId, trade.buyer, refundWei);
        }
    }

    function reviewEvidence(bytes32 tradeId, bool approved, bytes32 reasonHash) external {
        Trade storage trade = trades[tradeId];
        if (!verifiers[msg.sender]) revert Unauthorized();
        if (trade.status != Status.EvidenceSubmitted) revert InvalidState();
        if (msg.sender == trade.seller) revert Unauthorized();
        trade.status = approved ? Status.EvidenceApproved : Status.Disputed;
        emit EvidenceReviewed(tradeId, approved, reasonHash);
        if (!approved) {
            uint256 refundWei = escrowedWei[tradeId];
            if (refundWei > 0) {
                escrowedWei[tradeId] = 0;
                (bool refunded,) = payable(trade.buyer).call{value: refundWei}('');
                if (!refunded) revert PaymentTransferFailed();
                emit TradePaymentRefunded(tradeId, trade.buyer, refundWei);
            }
        }
    }

    function settleTrade(bytes32 tradeId) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.EvidenceApproved) revert InvalidState();
        if (msg.sender != trade.buyer && msg.sender != trade.seller) revert Unauthorized();
        _settle(tradeId, trade);
    }

    function _settle(bytes32 tradeId, Trade storage trade) private {
        trade.status = Status.Settled;
        uint256 points = uint256(trade.energyWh) / 100;
        if (points == 0) points = 1;
        demoPoints[trade.seller] += points;
        demoPoints[trade.buyer] += points;
        uint256 paymentWei = escrowedWei[tradeId];
        if (paymentWei > 0) {
            escrowedWei[tradeId] = 0;
            (bool paid,) = payable(trade.seller).call{value: paymentWei}('');
            if (!paid) revert PaymentTransferFailed();
            emit TradePaymentReleased(tradeId, trade.seller, paymentWei);
        }
        emit TradeSettled(tradeId, trade.buyer, trade.seller, trade.energyWh, points, points);
    }

    function getTrade(bytes32 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    function _quotePayment(uint64 energyWh, uint128 pricePerKWhScaled)
        private
        view
        returns (uint256 paymentWei, uint256 ethUsdPrice)
    {
        if (address(ethUsdPriceFeed) == address(0) || ethUsdPriceFeed.decimals() != 8) {
            revert InvalidPriceFeed();
        }
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ethUsdPriceFeed.latestRoundData();
        if (
            answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp ||
            block.timestamp - updatedAt > MAX_PRICE_AGE || answeredInRound < roundId
        ) revert InvalidPriceFeed();

        uint256 totalUsdScaled = (uint256(energyWh) * uint256(pricePerKWhScaled) + 999) / 1000;
        if (totalUsdScaled == 0 || totalUsdScaled > MAX_TRADE_USD_SCALED) revert InvalidTrade();
        ethUsdPrice = uint256(answer);
        paymentWei = (totalUsdScaled * USD_TO_WEI_SCALE + ethUsdPrice - 1) / ethUsdPrice;
    }
}
