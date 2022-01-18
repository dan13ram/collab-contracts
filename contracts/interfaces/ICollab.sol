// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface ICollab {
    function init(
        address _funder,
        address _doer,
        address _feeStore
    ) external;

    function createNewGig(bytes calldata _data, bytes calldata _signatures)
        external;

    function startNewGig(bytes calldata _data, bytes calldata _signatures)
        external;

    function startGig(uint256 _gigId) external;

    function cancelGig(uint256 _gigId) external;

    function completeGig(bytes calldata _data, bytes calldata _signatures)
        external;

    function lockGig(uint256 _gigId) external payable;

    function resolveGig(
        uint256 _gigId,
        uint8[3] calldata _feeRatio,
        uint8[2] calldata _rewardRatio,
        bytes calldata hash
    ) external;

    function updateGigHash(bytes calldata _data, bytes calldata _signatures)
        external;

    function updateGigResolver(bytes calldata _data, bytes calldata _signatures)
        external;

    function updateGigThirdParty(uint256 _gigId, address _thirdParty) external;
}
