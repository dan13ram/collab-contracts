// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICollabFactory {
    function create(address _funder, address _doer) external returns (address);

    function createDeterministic(
        address _funder,
        address _doer,
        bytes32 _salt
    ) external returns (address);

    function predictDeterministicAddress(bytes32 _salt)
        external
        returns (address);
}
