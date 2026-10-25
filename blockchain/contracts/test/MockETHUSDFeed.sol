// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockETHUSDFeed {
    int256 private immutable answer;

    constructor(int256 initialAnswer) {
        answer = initialAnswer;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 currentAnswer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}
