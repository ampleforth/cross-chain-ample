pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "./SafeMathInt.sol";
import "./UInt256Lib.sol";
import "./UFragments.sol";

interface IOracle {
    function getData() external returns (uint256, bool);
}

contract UFragmentsPolicy is OwnableUpgradeSafe {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using UInt256Lib for uint256;

    event LogRebase(
        uint256 indexed epoch,
        uint256 exchangeRate,
        uint256 cpi,
        int256 requestedSupplyAdjustment,
        uint256 timestampSec
    );

    UFragments public uFrags;
    IOracle public cpiOracle;
    IOracle public marketOracle;

    uint256 private baseCpi;
    uint256 public deviationThreshold;
    uint256 public rebaseLag;
    uint256 public minRebaseTimeIntervalSec;
    uint256 public lastRebaseTimestampSec;
    uint256 public rebaseWindowOffsetSec;
    uint256 public rebaseWindowLengthSec;
    uint256 public epoch;

    uint256 private constant DECIMALS = 18;
    uint256 private constant MAX_RATE = 10**6 * 10**DECIMALS;
    uint256 private constant MAX_SUPPLY = ~(uint256(1) << 255) / MAX_RATE;

    address public orchestrator;

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator);
        _;
    }

    function rebase() external onlyOrchestrator {
        require(inRebaseWindow());

        require(lastRebaseTimestampSec.add(minRebaseTimeIntervalSec) < now);

        lastRebaseTimestampSec = now.sub(now.mod(minRebaseTimeIntervalSec)).add(
            rebaseWindowOffsetSec
        );

        epoch = epoch.add(1);

        uint256 cpi;
        bool cpiValid;
        (cpi, cpiValid) = cpiOracle.getData();
        require(cpiValid);

        uint256 targetRate = cpi.mul(10**DECIMALS).div(baseCpi);

        uint256 exchangeRate;
        bool rateValid;
        (exchangeRate, rateValid) = marketOracle.getData();
        require(rateValid);

        if (exchangeRate > MAX_RATE) {
            exchangeRate = MAX_RATE;
        }

        int256 supplyDelta = computeSupplyDelta(exchangeRate, targetRate);

        supplyDelta = supplyDelta.div(rebaseLag.toInt256Safe());

        if (supplyDelta > 0 && uFrags.totalSupply().add(uint256(supplyDelta)) > MAX_SUPPLY) {
            supplyDelta = (MAX_SUPPLY.sub(uFrags.totalSupply())).toInt256Safe();
        }

        uint256 supplyAfterRebase = uFrags.rebase(epoch, supplyDelta);
        assert(supplyAfterRebase <= MAX_SUPPLY);
        emit LogRebase(epoch, exchangeRate, cpi, supplyDelta, now);
    }

    function setCpiOracle(IOracle cpiOracle_) external onlyOwner {
        cpiOracle = cpiOracle_;
    }

    function setMarketOracle(IOracle marketOracle_) external onlyOwner {
        marketOracle = marketOracle_;
    }

    function setOrchestrator(address orchestrator_) external onlyOwner {
        orchestrator = orchestrator_;
    }

    function setDeviationThreshold(uint256 deviationThreshold_) external onlyOwner {
        deviationThreshold = deviationThreshold_;
    }

    function setRebaseLag(uint256 rebaseLag_) external onlyOwner {
        require(rebaseLag_ > 0);
        rebaseLag = rebaseLag_;
    }

    function setRebaseTimingParameters(
        uint256 minRebaseTimeIntervalSec_,
        uint256 rebaseWindowOffsetSec_,
        uint256 rebaseWindowLengthSec_
    ) external onlyOwner {
        require(minRebaseTimeIntervalSec_ > 0);
        require(rebaseWindowOffsetSec_ < minRebaseTimeIntervalSec_);

        minRebaseTimeIntervalSec = minRebaseTimeIntervalSec_;
        rebaseWindowOffsetSec = rebaseWindowOffsetSec_;
        rebaseWindowLengthSec = rebaseWindowLengthSec_;
    }

    function initialize(
        address owner_,
        UFragments uFrags_,
        uint256 baseCpi_
    ) public initializer {
        __Ownable_init();
        transferOwnership(owner_);

        deviationThreshold = 5 * 10**(DECIMALS - 2);

        rebaseLag = 30;
        minRebaseTimeIntervalSec = 1 days;

        rebaseWindowLengthSec = 15 minutes;
        lastRebaseTimestampSec = 0;
        epoch = 0;

        uFrags = uFrags_;
        baseCpi = baseCpi_;
    }

    function inRebaseWindow() public view returns (bool) {
        return (now.mod(minRebaseTimeIntervalSec) >= rebaseWindowOffsetSec &&
            now.mod(minRebaseTimeIntervalSec) < (rebaseWindowOffsetSec.add(rebaseWindowLengthSec)));
    }

    function computeSupplyDelta(uint256 rate, uint256 targetRate) private view returns (int256) {
        if (withinDeviationThreshold(rate, targetRate)) {
            return 0;
        }

        int256 targetRateSigned = targetRate.toInt256Safe();
        return
            uFrags.totalSupply().toInt256Safe().mul(rate.toInt256Safe().sub(targetRateSigned)).div(
                targetRateSigned
            );
    }

    function withinDeviationThreshold(uint256 rate, uint256 targetRate)
        private
        view
        returns (bool)
    {
        uint256 absoluteDeviationThreshold = targetRate.mul(deviationThreshold).div(10**DECIMALS);

        return
            (rate >= targetRate && rate.sub(targetRate) < absoluteDeviationThreshold) ||
            (rate < targetRate && targetRate.sub(rate) < absoluteDeviationThreshold);
    }
}
