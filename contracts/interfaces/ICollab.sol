// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface ICollab {
    function init(address _giver, address _doer) external;

    function createNewGig(bytes calldata _data, bytes calldata _signatures)
        external;

    function startNewGig(bytes calldata _data, bytes calldata _signatures)
        external;

    function startGig(bytes calldata _data, bytes calldata _signatures)
        external;

    // function cancelGig() external;

    // function lockGig() external;

    // function resolveGig() external;

    // function completeGig() external;

    // function updateGigHash() external;

    // function updateGigResolver() external;

    // function updateGigRewards() external;
}
