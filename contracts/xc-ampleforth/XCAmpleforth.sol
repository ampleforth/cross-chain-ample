pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

/**
 * @title XC(cross-chain) Ampleforth ERC20 token
 *
 * @dev This is a 'bridge-secured' implementation of the Ampleforth ERC20 token on
 *      EVM compilable chains. XCAmpleforth behaves exactly the same as the Ampleforth ERC20
 *      on Ethereum, wrt. rebasing and balance changes.
 *
 *      Additionally, the XCAmpleforth can `mint` or `burn` tokens.
 *
 */
contract XCAmpleforth is IERC20, OwnableUpgradeSafe {
    // PLEASE EXERCISE CAUTION BEFORE CHANGING ANY ACCOUNTING OR MATH
    using SafeMath for uint256;

    event LogRebase(uint256 indexed epoch, uint256 totalAMPLSupply);
    event ControllerUpdated(address controller);

    // Used for authentication
    address public controller;

    modifier onlyController() {
        require(msg.sender == controller);
        _;
    }

    modifier validRecipient(address to) {
        require(to != address(0x0));
        require(to != address(this));
        _;
    }

    uint256 private constant DECIMALS = 9;
    uint256 private constant MAX_UINT256 = ~uint256(0);
    uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**DECIMALS;

    // TOTAL_GONS is a multiple of INITIAL_AMPL_SUPPLY so that _gonsPerAMPL is an integer.
    // Use the highest value that fits in a uint256 for max granularity.
    uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

    // MAX_SUPPLY = maximum integer < (sqrt(4*TOTAL_GONS + 1) - 1) / 2
    uint256 private constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1

    // ERC-20 identity attributes
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // The total supply of AMPL
    uint256 public totalAMPLSupply;
    uint256 private _gonsPerAMPL;

    // The total supply of xc-ampl, ie) the total xc-ampl currently in circulation
    uint256 private _totalSupply;

    // Gons are an internal denomination to represent wallet balances for rebase safe accounting
    // The value denotes the wallet's share of the total AMPL supply
    // public wallet balance = _gonBalances[wallet] * _gonsPerAMPL
    mapping(address => uint256) private _gonBalances;

    // This is denominated in XCAmpl amount,
    // because the gons xc-ampl conversion might change before it's fully paid.
    mapping(address => mapping(address => uint256)) private _allowedXCAmples;

    /**
     * @param controller_ The address of the controller contract to use for authentication.
     */
    function setController(address controller_) external onlyOwner {
        controller = controller_;
        emit ControllerUpdated(controller_);
    }

    /**
     * @dev Notifies Amples contract about a new rebase cycle.
     * @param newTotalSupply The new total supply from the master chain.
     * @return The total number of amples after the supply adjustment.
     */
    function rebase(uint256 epoch, uint256 newTotalSupply)
        external
        onlyController
        returns (uint256)
    {
        if (newTotalSupply == totalAMPLSupply) {
            emit LogRebase(epoch, totalAMPLSupply);
            return totalAMPLSupply;
        }

        _totalSupply = _totalSupply.mul(newTotalSupply).div(totalAMPLSupply);

        totalAMPLSupply = newTotalSupply;

        _gonsPerAMPL = TOTAL_GONS.div(totalAMPLSupply);

        emit LogRebase(epoch, totalAMPLSupply);
        return totalAMPLSupply;
    }

    /**
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(
        string memory name,
        string memory symbol,
        uint256 totalAMPLSupply_
    ) public initializer {
        __Ownable_init();

        _name = name;
        _symbol = symbol;
        _decimals = uint8(DECIMALS);

        totalAMPLSupply = totalAMPLSupply_;
        _totalSupply = 0;

        _gonsPerAMPL = TOTAL_GONS.div(totalAMPLSupply);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
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
    function decimals() public view returns (uint8) {
        return _decimals;
    }

    /**
     * @return The total supply of amples.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @param who The address to query.
     * @return The balance of the specified address.
     */
    function balanceOf(address who) public view override returns (uint256) {
        return _gonBalances[who].div(_gonsPerAMPL);
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param to The address to transfer to.
     * @param value The amount to be transferred.
     * @return True on success, false otherwise.
     */
    function transfer(address to, uint256 value) public override validRecipient(to) returns (bool) {
        uint256 gonValue = value.mul(_gonsPerAMPL);
        _gonBalances[msg.sender] = _gonBalances[msg.sender].sub(gonValue);
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
    function allowance(address owner_, address spender) public view override returns (uint256) {
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
    ) public override validRecipient(to) returns (bool) {
        _allowedXCAmples[from][msg.sender] = _allowedXCAmples[from][msg.sender].sub(value);

        uint256 gonValue = value.mul(_gonsPerAMPL);
        _gonBalances[from] = _gonBalances[from].sub(gonValue);
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
     *
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value) public override returns (bool) {
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
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
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
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
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
     * @dev Mint xc-amples to a beneficiary.
     *
     * @param who The address of the beneficiary.
     * @param xcAmplAmount The amount of xc-ampl tokens to be minted.
     */
    function mint(address who, uint256 xcAmplAmount) public onlyController {
        require(who != address(0));

        uint256 gonValue = xcAmplAmount.mul(_gonsPerAMPL);
        _gonBalances[who] = _gonBalances[who].add(gonValue);
        _totalSupply = _totalSupply.add(xcAmplAmount);

        require(_totalSupply <= totalAMPLSupply);
        require(_totalSupply <= MAX_SUPPLY);

        emit Transfer(address(0), who, xcAmplAmount);
    }

    /**
     * @dev Burn xc-amples from the beneficiary.
     *
     * @param who The address of the beneficiary.
     * @param xcAmplAmount The amount of xc-ampl tokens to be burned.
     */
    function burn(address who, uint256 xcAmplAmount) public onlyController {
        require(who != address(0));

        uint256 gonValue = xcAmplAmount.mul(_gonsPerAMPL);
        _gonBalances[who] = _gonBalances[who].sub(gonValue);
        _totalSupply = _totalSupply.sub(xcAmplAmount);

        emit Transfer(who, address(0), xcAmplAmount);
    }
}
