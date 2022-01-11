// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time, max-states-count

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/ICollab.sol";
import "./libraries/SignatureDecoder.sol";

contract MetaCollab is ICollab, Initializable, Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public giver;
    address public doer;

    enum Status {
        init,
        active,
        countdown,
        locked,
        cancel,
        done,
        expired
    }

    struct Gig {
        Status status;
        address[] tokens;
        uint256[] amounts;
        uint256[2] rewardRatio;
        uint256 startTimestamp;
        uint256 countdownTimestamp;
        uint256 endTimestamp;
        uint256[3] durations; // [cancellationDuration, countdownDuration, expirationDuration]
        address resolver;
        uint256 fixedFee;
        uint256[2] resolverFeeRatio;
    }

    event GigInit(uint256 indexed gigId, bytes hash);
    event GigActive(uint256 indexed gigId);
    event GigHashUpdated(uint256 indexed gigId, bytes hash);
    event GigResolverUpdated(uint256 indexed gigId);
    event GigRewardsUpdated(uint256 indexed gigId);
    event GigLockCountdownStarted(uint256 indexed gigId);
    event GigLockedForDispute(uint256 indexed gigId);
    event GigCancelled(uint256 indexed gigId);
    event GigExpired(uint256 indexed gigId);
    event GigDone();

    mapping(uint256 => Gig) public gigs;
    uint256 public gigCount;

    function init(address _giver, address _doer) external override initializer {
        require(_giver != address(0), "invalid giver");
        require(_doer != address(0), "invalid doer");

        giver = _giver;
        doer = _doer;
    }

    modifier verified(bytes calldata _data, bytes calldata _signatures) {
        SignatureDecoder.verifySignatures(_data, _signatures, giver, doer);
        _;
    }

    function _newGig(
        bytes memory _hash,
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256[3] memory _durations,
        address _resolver
    ) internal {
        Gig storage gig = gigs[gigCount];
        gig.status = Status.init;
        gig.tokens = _tokens;
        gig.amounts = _amounts;
        gig.rewardRatio[0] = 0;
        gig.rewardRatio[1] = 1;
        gig.startTimestamp = block.timestamp;
        require(_durations[2] > 0, "invalid expiration duration");
        gig.durations = _durations;

        if (_resolver != address(0)) {
            gig.resolver = _resolver;
            // init resolver fees
        }

        emit GigInit(gigCount, _hash);
        gigCount++;
    }

    function createNewGig(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (
            bytes memory _hash,
            address[] memory _tokens,
            uint256[] memory _amounts,
            uint256[3] memory _durations,
            address _resolver,
            address _collab,
            uint256 _gigCount
        ) = abi.decode(
                _data,
                (
                    bytes,
                    address[],
                    uint256[],
                    uint256[3],
                    address,
                    address,
                    uint256
                )
            );
        require(
            _gigCount == gigCount &&
                _collab == address(this) &&
                _tokens.length == _amounts.length,
            "invalid data"
        );

        _newGig(_hash, _tokens, _amounts, _durations, _resolver);
    }

    function startNewGig(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (
            bytes memory _hash,
            address[] memory _tokens,
            uint256[] memory _amounts,
            uint256[3] memory _durations,
            address _resolver,
            address _collab,
            uint256 _gigCount
        ) = abi.decode(
                _data,
                (
                    bytes,
                    address[],
                    uint256[],
                    uint256[3],
                    address,
                    address,
                    uint256
                )
            );
        require(
            _gigCount == gigCount &&
                _collab == address(this) &&
                _tokens.length == _amounts.length,
            "invalid data"
        );
        _newGig(_hash, _tokens, _amounts, _durations, _resolver);
        _startGig(_gigCount);
    }

    function _startGig(uint256 _gigId) internal {
        Gig storage gig = gigs[_gigId];
        require(gig.status == Status.init, "invalid gig");
        for (uint256 i = 0; i < gig.tokens.length; i = i + 1) {
            IERC20 erc20 = IERC20(gig.tokens[i]);
            erc20.safeTransferFrom(giver, address(this), gig.amounts[i]);
        }
        gig.status = Status.active;

        emit GigActive(_gigId);
    }

    function startGig(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (address _collab, uint256 _gigId) = abi.decode(
            _data,
            (address, uint256)
        );
        require(_collab == address(this), "invalid data");

        _startGig(_gigId);
    }
}
