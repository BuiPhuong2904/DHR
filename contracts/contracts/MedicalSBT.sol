// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MedicalSBT is ERC721, AccessControl {
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes4 private constant ERC5192_INTERFACE_ID = 0xb45a3c0e;

    struct Certificate {
        address patient;
        string certType;
        uint64 issuedAt;
        uint64 expiresAt;
        string uri;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Certificate) private _certs;
    mapping(address => mapping(bytes32 => uint256)) private _latestCert;

    /// ERC-5192
    event Locked(uint256 tokenId);
    event CertificateIssued(uint256 indexed tokenId, address indexed patient, string certType, uint64 expiresAt);
    event CertificateRevoked(uint256 indexed tokenId, address indexed patient);

    error Soulbound();
    error InvalidExpiry();
    error EmptyValue();

    constructor(address admin) ERC721("DHR Medical Certificate", "DHRSBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /* ====================== NGHIỆP VỤ TOKEN ====================== */

    /// Nghiệp vụ "Cấp chứng nhận": chỉ bệnh viện được mint
    function mint(
        address patient,
        string calldata certType,
        uint64 expiresAt,
        string calldata uri
    ) external onlyRole(HOSPITAL_ROLE) returns (uint256 tokenId) {
        if (bytes(certType).length == 0) revert EmptyValue();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        tokenId = _nextTokenId++;
        _mint(patient, tokenId);
        _certs[tokenId] = Certificate({
            patient: patient,
            certType: certType,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            uri: uri
        });
        _latestCert[patient][keccak256(bytes(certType))] = tokenId;

        emit Locked(tokenId);
        emit CertificateIssued(tokenId, patient, certType, expiresAt);
    }

    /// Thu hồi chứng nhận (đốt token)
    function revoke(uint256 tokenId) external onlyRole(HOSPITAL_ROLE) {
        address patient = _requireOwned(tokenId);
        bytes32 typeKey = keccak256(bytes(_certs[tokenId].certType));
        if (_latestCert[patient][typeKey] == tokenId) delete _latestCert[patient][typeKey];
        delete _certs[tokenId];
        _burn(tokenId);
        emit CertificateRevoked(tokenId, patient);
    }

    /// Nghiệp vụ "Xác thực"
    function hasValidCertificate(address patient, string calldata certType) external view returns (bool) {
        uint256 tokenId = _latestCert[patient][keccak256(bytes(certType))];
        if (tokenId == 0 || _ownerOf(tokenId) != patient) return false;
        uint64 exp = _certs[tokenId].expiresAt;
        return exp == 0 || exp > block.timestamp;
    }

    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        _requireOwned(tokenId);
        return _certs[tokenId];
    }

    /// ERC-5192: mọi token đều bị khóa vĩnh viễn
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _certs[tokenId].uri;
    }

    /* ====================== SOULBOUND ====================== */

    /// Mọi lần chuyển nhượng (from != 0 và to != 0) đều bị chặn. Chỉ cho phép mint và burn.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return interfaceId == ERC5192_INTERFACE_ID || super.supportsInterface(interfaceId);
    }
}
