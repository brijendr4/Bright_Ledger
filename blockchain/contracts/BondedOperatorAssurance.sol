// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Hackathon MVP for a project-scoped operator performance bond.
/// Project funding is never held by this contract.
contract BondedOperatorAssurance {
    enum MilestoneStatus { None, Submitted, Approved, Rejected }

    struct Bond {
        address operator;
        uint256 amount;
        uint64 unlockAt;
        bool released;
        uint256 slashed;
    }

    struct Milestone {
        MilestoneStatus status;
        bytes32 evidenceHash;
    }

    address public immutable governance;
    mapping(bytes32 => Bond) public bonds;
    mapping(bytes32 => mapping(bytes32 => Milestone)) public milestones;
    mapping(address => bool) public verifiers;

    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error TransferFailed();

    event BondPosted(bytes32 indexed projectId, address indexed operator, uint256 amount, uint64 unlockAt);
    event MilestoneSubmitted(bytes32 indexed projectId, bytes32 indexed milestoneId, bytes32 evidenceHash);
    event MilestoneReviewed(bytes32 indexed projectId, bytes32 indexed milestoneId, bool approved, bytes32 reasonHash);
    event BondSlashed(bytes32 indexed projectId, address indexed operator, uint256 amount, bytes32 reasonHash);
    event BondReleased(bytes32 indexed projectId, address indexed operator, uint256 amount);

    constructor(address initialGovernance) {
        if (initialGovernance == address(0)) revert InvalidInput();
        governance = initialGovernance;
        verifiers[initialGovernance] = true;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    function setVerifier(address account, bool enabled) external onlyGovernance {
        if (account == address(0)) revert InvalidInput();
        verifiers[account] = enabled;
    }

    function postBond(bytes32 projectId, uint64 unlockAt) external payable {
        if (projectId == bytes32(0) || msg.value == 0 || unlockAt <= block.timestamp) revert InvalidInput();
        Bond storage bond = bonds[projectId];
        if (bond.operator != address(0) || bond.released) revert InvalidState();
        bond.operator = msg.sender;
        bond.amount = msg.value;
        bond.unlockAt = unlockAt;
        emit BondPosted(projectId, msg.sender, msg.value, unlockAt);
    }

    function submitMilestone(bytes32 projectId, bytes32 milestoneId, bytes32 evidenceHash) external {
        Bond storage bond = bonds[projectId];
        if (bond.operator != msg.sender || evidenceHash == bytes32(0)) revert Unauthorized();
        Milestone storage milestone = milestones[projectId][milestoneId];
        if (milestone.status != MilestoneStatus.None && milestone.status != MilestoneStatus.Rejected) revert InvalidState();
        milestone.status = MilestoneStatus.Submitted;
        milestone.evidenceHash = evidenceHash;
        emit MilestoneSubmitted(projectId, milestoneId, evidenceHash);
    }

    function reviewMilestone(bytes32 projectId, bytes32 milestoneId, bool approved, bytes32 reasonHash) external {
        if (!verifiers[msg.sender]) revert Unauthorized();
        Milestone storage milestone = milestones[projectId][milestoneId];
        if (milestone.status != MilestoneStatus.Submitted) revert InvalidState();
        milestone.status = approved ? MilestoneStatus.Approved : MilestoneStatus.Rejected;
        emit MilestoneReviewed(projectId, milestoneId, approved, reasonHash);
    }

    function slashBond(bytes32 projectId, uint256 amount, bytes32 reasonHash) external {
        if (!verifiers[msg.sender] || amount == 0 || reasonHash == bytes32(0)) revert Unauthorized();
        Bond storage bond = bonds[projectId];
        if (bond.operator == address(0) || bond.released || amount > bond.amount - bond.slashed) revert InvalidState();
        bond.slashed += amount;
        (bool sent,) = payable(governance).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit BondSlashed(projectId, bond.operator, amount, reasonHash);
    }

    function releaseBond(bytes32 projectId) external {
        Bond storage bond = bonds[projectId];
        if (msg.sender != bond.operator || bond.released || block.timestamp < bond.unlockAt) revert Unauthorized();
        bond.released = true;
        uint256 amount = bond.amount - bond.slashed;
        if (amount > 0) {
            (bool sent,) = payable(bond.operator).call{value: amount}("");
            if (!sent) revert TransferFailed();
        }
        emit BondReleased(projectId, bond.operator, amount);
    }
}
