// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title XC(cross-chain)Ample ERC20 token
 *
 * @dev This is a 'bridge-secured' implementation of the AMPL ERC20 token deployed on
 *      EVM compilable satellite chains. XCAmple behaves exactly the same as the AMPL does
 *      on Ethereum, wrt. rebasing and balance changes.
 *
 *      Additionally, the XCAmple contract lets the XCAmpleController
 *      `mint` or `burn` tokens.
 */
contract XCAmple is IERC20Upgradeable, OwnableUpgradeable {
    // PLEASE EXERCISE CAUTION BEFORE CHANGING ANY ACCOUNTING OR MATH
    using SafeMathUpgradeable for uint256;

    event LogRebase(uint256 indexed epoch, uint256 globalAMPLSupply);
    event ControllerUpdated(address controller);

    // Used for authentication
    address public controller;

    modifier onlyController() {
        require(msg.sender == controller, "XCAmple: caller not controller");
        _;
    }

    modifier validRecipient(address to) {
        require(to != address(0x0), "XCAmple: recipient zero address");
        require(to != address(this), "XCAmple: recipient token address");
        _;
    }

    uint256 private constant DECIMALS = 9;
    uint256 private constant MAX_UINT256 = type(uint256).max; // (2^256) - 1
    uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**DECIMALS;

    // TOTAL_GONS is a multiple of INITIAL_AMPL_SUPPLY so that _gonsPerAMPL is an integer.
    // Use the highest value that fits in a uint256 for max granularity.
    uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

    // MAX_SUPPLY = maximum integer < (sqrt(4*TOTAL_GONS + 1) - 1) / 2
    uint256 private constant MAX_SUPPLY = type(uint128).max; // (2^128) - 1

    // ERC-20 identity attributes
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // The total supply of AMPL token
    uint256 public globalAMPLSupply;

    // AMPL's internal scalar, co-efficient of expansion/contraction
    uint256 private _gonsPerAMPL;

    // The total supply of xcAmple, ie) the total xcAmple currently in circulation
    uint256 private _totalSupply;

    // Gons are an internal denomination to represent wallet balances for rebase safe accounting
    // The value denotes the wallet's share of the total AMPL supply
    // public wallet balance = _gonBalances[wallet] * _gonsPerAMPL
    mapping(address => uint256) private _gonBalances;

    // This is denominated in XCAmple amount,
    // because the gons xcAmple conversion might change before it's fully paid.
    mapping(address => mapping(address => uint256)) private _allowedXCAmples;

    // EIP-2612: permit – 712-signed approvals
    // https://eips.ethereum.org/EIPS/eip-2612
    string public constant EIP712_REVISION = "1";
    bytes32 public constant EIP712_DOMAIN =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    // EIP-2612: keeps track of number of permits per address
    mapping(address => uint256) private _nonces;

    /**
     * @param controller_ The address of the controller contract to use for authentication.
     */
    function setController(address controller_) external onlyOwner {
        controller = controller_;
        emit ControllerUpdated(controller_);
    }

    /**
     * @dev XCAmpleController notifies this contract about a new rebase cycle.
     * @param epoch The rebase epoch number.
     * @param newGlobalAMPLSupply The new total supply of AMPL from the base chain.
     * @return The new total AMPL supply.
     */
    function rebase(uint256 epoch, uint256 newGlobalAMPLSupply)
        external
        onlyController
        returns (uint256)
    {
        uint256 prevGlobalAMPLSupply = globalAMPLSupply;
        if (newGlobalAMPLSupply == prevGlobalAMPLSupply) {
            emit LogRebase(epoch, prevGlobalAMPLSupply);
            return prevGlobalAMPLSupply;
        }

        // update xc-ample total supply
        _totalSupply = _totalSupply.mul(newGlobalAMPLSupply).div(prevGlobalAMPLSupply);

        // update AMPL global supply
        globalAMPLSupply = newGlobalAMPLSupply;

        // update scalar
        _gonsPerAMPL = TOTAL_GONS.div(newGlobalAMPLSupply);

        emit LogRebase(epoch, newGlobalAMPLSupply);

        return newGlobalAMPLSupply;
    }

    /**
     * @dev ZOS upgradeable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract state variables.
     */
    function initialize(
        string memory name,
        string memory symbol,
        uint256 globalAMPLSupply_
    ) public initializer {
        __Ownable_init();

        _name = name;
        _symbol = symbol;
        _decimals = uint8(DECIMALS);

        globalAMPLSupply = globalAMPLSupply_;
        _totalSupply = 0;

        _gonsPerAMPL = TOTAL_GONS.div(globalAMPLSupply);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Returns the computed DOMAIN_SEPARATOR to be used off-chain services
     *      which implement EIP-2612.
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN,
                    keccak256(bytes(_name)),
                    keccak256(bytes(EIP712_REVISION)),
                    chainId,
                    address(this)
                )
            );
    }

    /**
     * @return The total supply of xcAmples.
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @param who The address to query.
     * @return The balance of the specified address.
     */
    function balanceOf(address who) external view override returns (uint256) {
        return _gonBalances[who].div(_gonsPerAMPL);
    }

    /**
     * @param who The address to query.
     * @return The gon balance of the specified address.
     */
    function scaledBalanceOf(address who) external view returns (uint256) {
        return _gonBalances[who];
    }

    /**
     * @return the total number of gons.
     */
    function scaledTotalSupply() external pure returns (uint256) {
        return TOTAL_GONS;
    }

    /**
     * @return The number of successful permits by the specified address.
     */
    function nonces(address who) public view returns (uint256) {
        return _nonces[who];
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param to The address to transfer to.
     * @param value The amount to be transferred.
     * @return True on success, false otherwise.
     */
    function transfer(address to, uint256 value)
        external
        override
        validRecipient(to)
        returns (bool)
    {
        uint256 gonValue = value.mul(_gonsPerAMPL);

        _gonBalances[msg.sender] = _gonBalances[msg.sender].sub(gonValue);
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @dev Transfer all of the sender's wallet balance to a specified address.
     * @param to The address to transfer to.
     * @return True on success, false otherwise.
     */
    function transferAll(address to) external validRecipient(to) returns (bool) {
        uint256 gonValue = _gonBalances[msg.sender];
        uint256 value = gonValue.div(_gonsPerAMPL);

        delete _gonBalances[msg.sender];
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @dev Function to check the amount of tokens that an owner has allowed to a spender.
     * @param owner_ The address which owns the funds.
     * @param spender The address which will spend the funds.
     * @return The number of tokens still available for the spender.
     */
    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowedXCAmples[owner_][spender];
    }

    /**
     * @dev Transfer tokens from one address to another.
     * @param from The address you want to send tokens from.
     * @param to The address you want to transfer to.
     * @param value The amount of tokens to be transferred.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override validRecipient(to) returns (bool) {
        _allowedXCAmples[from][msg.sender] = _allowedXCAmples[from][msg.sender].sub(value);

        uint256 gonValue = value.mul(_gonsPerAMPL);

        _gonBalances[from] = _gonBalances[from].sub(gonValue);
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @dev Transfer all balance tokens from one address to another.
     * @param from The address you want to send tokens from.
     * @param to The address you want to transfer to.
     */
    function transferAllFrom(address from, address to) external validRecipient(to) returns (bool) {
        uint256 gonValue = _gonBalances[from];
        uint256 value = gonValue.div(_gonsPerAMPL);

        _allowedXCAmples[from][msg.sender] = _allowedXCAmples[from][msg.sender].sub(value);

        delete _gonBalances[from];
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of
     * msg.sender. This method is included for ERC20 compatibility.
     * increaseAllowance and decreaseAllowance should be used instead.
     * Changing an allowance with this method brings the risk that someone may transfer both
     * the old and the new allowance - if they are both greater than zero - if a transfer
     * transaction is mined before the later approve() call is mined.
     * Approvals are denominated in xc-amples and do NOT change with underlying balances.
     *
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value) external override returns (bool) {
        _allowedXCAmples[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev Increase the amount of tokens that an owner has allowed to a spender.
     * This method should be used instead of approve() to avoid the double approval vulnerability
     * described above.
     * @param spender The address which will spend the funds.
     * @param addedValue The amount of tokens to increase the allowance by.
     */
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        _allowedXCAmples[msg.sender][spender] = _allowedXCAmples[msg.sender][spender].add(
            addedValue
        );

        emit Approval(msg.sender, spender, _allowedXCAmples[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of tokens that an owner has allowed to a spender.
     *
     * @param spender The address which will spend the funds.
     * @param subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 oldValue = _allowedXCAmples[msg.sender][spender];
        if (subtractedValue >= oldValue) {
            _allowedXCAmples[msg.sender][spender] = 0;
        } else {
            _allowedXCAmples[msg.sender][spender] = oldValue.sub(subtractedValue);
        }

        emit Approval(msg.sender, spender, _allowedXCAmples[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Mint xcAmples to a beneficiary.
     *      Only callable by the token controller.
     *
     * @param who The address of the beneficiary.
     * @param xcAmpleAmount The amount of xcAmple tokens to be minted.
     */
    function mint(address who, uint256 xcAmpleAmount) external onlyController validRecipient(who) {
        uint256 gonValue = xcAmpleAmount.mul(_gonsPerAMPL);
        _gonBalances[who] = _gonBalances[who].add(gonValue);
        _totalSupply = _totalSupply.add(xcAmpleAmount);

        require(_totalSupply <= globalAMPLSupply, "XCAmple: total mint exceeded total ampl supply");
        require(_totalSupply <= MAX_SUPPLY, "XCAmple: total mint exceeded max supply");

        emit Transfer(address(0), who, xcAmpleAmount);
    }

    /**
     * @dev Destroys `xcAmpleAmount` tokens from `who`.
     *      Only callable by the token controller.
     *
     * @param who The address of the beneficiary.
     * @param xcAmpleAmount The amount of xcAmple tokens to be burned.
     */
    function burnFrom(address who, uint256 xcAmpleAmount) external onlyController {
        require(who != address(0), "XCAmple: burn address zero address");

        uint256 gonValue = xcAmpleAmount.mul(_gonsPerAMPL);
        _gonBalances[who] = _gonBalances[who].sub(gonValue);
        _totalSupply = _totalSupply.sub(xcAmpleAmount);

        emit Transfer(who, address(0), xcAmpleAmount);
    }

    /**
     * @dev Allows for approvals to be made via secp256k1 signatures.
     * @param owner The owner of the funds
     * @param spender The spender
     * @param value The amount
     * @param deadline The deadline timestamp, type(uint256).max for max deadline
     * @param v Signature param
     * @param s Signature param
     * @param r Signature param
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(block.timestamp <= deadline, "XCAmple: surpassed permit deadline");

        uint256 ownerNonce = _nonces[owner];
        bytes32 permitDataDigest = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, ownerNonce, deadline)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), permitDataDigest)
        );

        require(owner == ecrecover(digest, v, r, s), "XCAmple: signature invalid");

        _nonces[owner] = ownerNonce.add(1);

        _allowedXCAmples[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
