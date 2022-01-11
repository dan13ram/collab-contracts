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

    address public funder;
    address public doer;

    enum Status {
        init,
        active,
        countdown,
        locked,
        resolved,
        cancelled,
        expired,
        done
    }

    struct Gig {
        Status status;
        address[] tokens;
        uint256[] amounts;
        uint256 startTimestamp;
        uint256 countdownTimestamp;
        uint256 endTimestamp;
        uint256[3] durations; // [cancellationDuration, countdownDuration, expirationDuration]
        address resolver;
        uint256 fixedResolverFee;
        uint8[2] resolverFeeRatio;
    }

    event GigInit(uint256 indexed gigId, bytes hash);
    event GigActive(uint256 indexed gigId);
    event GigHashUpdated(uint256 indexed gigId, bytes hash);
    event GigResolverUpdated(uint256 indexed gigId);
    event GigLockCountdownStarted(uint256 indexed gigId);
    event GigLockedForDispute(uint256 indexed gigId);
    event GigCancelled(uint256 indexed gigId);
    event GigExpired(uint256 indexed gigId);
    event GigDone(uint256 indexed gigId, uint8 funderShare, uint8 doerShare);
    event GigResolved(
        uint256 indexed gigId,
        uint8 funderShare,
        uint8 doerShare
    );

    mapping(uint256 => Gig) public gigs;
    uint256 public gigCount;

    // solhint-disable-next-line no-empty-blocks
    constructor() initializer {}

    function init(address _funder, address _doer)
        external
        override
        initializer
    {
        require(_funder != address(0), "invalid funder");
        require(_doer != address(0), "invalid doer");

        funder = _funder;
        doer = _doer;
    }

    modifier verified(bytes calldata _data, bytes calldata _signatures) {
        SignatureDecoder.verifySignatures(_data, _signatures, funder, doer);
        _;
    }

    modifier onlyFunder() {
        require(_msgSender() == funder, "only funder");
        _;
    }

    modifier onlyParty() {
        require(_msgSender() == funder || _msgSender() == doer, "only party");
        _;
    }

    modifier onlyResolver(uint256 _gigId) {
        Gig storage gig = gigs[_gigId];
        require(_msgSender() == gig.resolver, "only resolver");
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
        gig.startTimestamp = block.timestamp;
        require(_durations[2] > 0, "invalid expiration duration");
        gig.durations = _durations;

        if (_resolver != address(0)) {
            gig.resolver = _resolver;
            // TODO: init resolver fees
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
            IERC20 token = IERC20(gig.tokens[i]);
            token.safeTransferFrom(funder, address(this), gig.amounts[i]);
        }
        gig.status = Status.active;

        emit GigActive(_gigId);
    }

    function startGig(uint256 _gigId)
        external
        override
        nonReentrant
        onlyFunder
    {
        _startGig(_gigId);
    }

    function _distributeGigRewards(
        uint256 _gigId,
        uint8 _funderShare,
        uint8 _doerShare
    ) internal {
        uint8 denom = _funderShare + _doerShare;
        require(denom != 0, "invalid distribution");
        Gig storage gig = gigs[_gigId];

        for (uint256 i = 0; i < gig.tokens.length; i = i + 1) {
            uint256 funderReward = (gig.amounts[i] * _funderShare) / denom;
            uint256 doerReward = gig.amounts[i] - funderReward;
            IERC20 token = IERC20(gig.tokens[i]);
            if (funderReward > 0) {
                token.safeTransferFrom(address(this), funder, funderReward);
            }
            if (doerReward > 0) {
                token.safeTransferFrom(address(this), doer, doerReward);
            }
        }
    }

    function cancelGig(uint256 _gigId)
        external
        override
        nonReentrant
        onlyFunder
    {
        Gig storage gig = gigs[_gigId];
        require(gig.status == Status.active, "invalid gig");
        uint256 timeElapsed = block.timestamp - gig.startTimestamp;

        if (timeElapsed < gig.durations[0]) {
            gig.status = Status.cancelled;
            _distributeGigRewards(_gigId, 1, 0);
            emit GigCancelled(_gigId);
        } else if (timeElapsed > gig.durations[2]) {
            gig.status = Status.expired;
            _distributeGigRewards(_gigId, 1, 0);
            emit GigExpired(_gigId);
        } else {
            revert("invalid timestamp");
        }
    }

    function lockGig(uint256 _gigId)
        external
        payable
        override
        nonReentrant
        onlyParty
    {
        Gig storage gig = gigs[_gigId];
        require(gig.resolver != address(0), "invalid resolver");
        if (gig.status == Status.active) {
            gig.status = Status.countdown;
            gig.countdownTimestamp = block.timestamp;
            emit GigLockCountdownStarted(_gigId);
        } else if (gig.status == Status.countdown) {
            uint256 timeElapsed = block.timestamp - gig.countdownTimestamp;
            require(timeElapsed >= gig.durations[0], "still counting");
            require(msg.value == gig.fixedResolverFee, "invalid value");
            if (gig.fixedResolverFee > 0) {
                payable(gig.resolver).transfer(gig.fixedResolverFee);
            }
            gig.status = Status.locked;
            emit GigLockedForDispute(_gigId);
        } else {
            revert("invalid gig");
        }
    }

    function completeGig(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (
            address _collab,
            uint256 _gigId,
            uint8 _funderShare,
            uint8 _doerShare
        ) = abi.decode(_data, (address, uint256, uint8, uint8));
        require(_collab == address(this), "invalid data");
        Gig storage gig = gigs[_gigId];
        require(
            gig.status == Status.active || gig.status == Status.countdown,
            "invalid gig"
        );
        gig.status = Status.done;
        _distributeGigRewards(_gigId, _funderShare, _doerShare);
        emit GigDone(_gigId, _funderShare, _doerShare);
    }

    function _resolveGigRewards(
        uint256 _gigId,
        uint8 _funderShare,
        uint8 _doerShare
    ) internal {
        Gig storage gig = gigs[_gigId];
        require(gig.status == Status.locked, "invalid gig");
        uint8 denom = _funderShare + _doerShare;
        uint8 feeDenom = gig.resolverFeeRatio[0] + gig.resolverFeeRatio[1];
        require(denom != 0 && feeDenom != 0, "invalid distribution");

        for (uint256 i = 0; i < gig.tokens.length; i = i + 1) {
            uint256 resolverReward = (gig.amounts[i] *
                gig.resolverFeeRatio[0]) / feeDenom;
            uint256 partyReward = gig.amounts[i] - resolverReward;
            uint256 funderReward = (partyReward * _funderShare) / denom;
            uint256 doerReward = partyReward - funderReward;
            IERC20 token = IERC20(gig.tokens[i]);
            if (resolverReward > 0) {
                token.safeTransferFrom(
                    address(this),
                    gig.resolver,
                    resolverReward
                );
            }
            if (funderReward > 0) {
                token.safeTransferFrom(address(this), funder, funderReward);
            }
            if (doerReward > 0) {
                token.safeTransferFrom(address(this), doer, doerReward);
            }
        }
        gig.status = Status.resolved;
    }

    function resolveGig(
        uint256 _gigId,
        uint8 _funderShare,
        uint8 _doerShare
    ) external override nonReentrant onlyResolver(_gigId) {
        _resolveGigRewards(_gigId, _funderShare, _doerShare);
        emit GigResolved(_gigId, _funderShare, _doerShare);
    }

    function updateGigHash(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (address _collab, uint256 _gigId, bytes memory _hash) = abi.decode(
            _data,
            (address, uint256, bytes)
        );
        require(_collab == address(this), "invalid data");
        Gig storage gig = gigs[_gigId];
        require(
            gig.status == Status.active || gig.status == Status.init,
            "invalid gig"
        );
        emit GigHashUpdated(_gigId, _hash);
    }

    function updateGigResolver(bytes calldata _data, bytes calldata _signatures)
        external
        override
        nonReentrant
        verified(_data, _signatures)
    {
        (address _collab, uint256 _gigId, address _resolver) = abi.decode(
            _data,
            (address, uint256, address)
        );
        require(
            _collab == address(this) && _resolver != address(0),
            "invalid data"
        );
        Gig storage gig = gigs[_gigId];
        require(
            gig.status == Status.active || gig.status == Status.init,
            "invalid gig"
        );
        gig.resolver = _resolver;
        // TODO: init resolver fees
        emit GigResolverUpdated(_gigId);
    }
}
