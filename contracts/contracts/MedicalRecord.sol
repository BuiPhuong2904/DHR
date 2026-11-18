// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MedicalRecord is AccessControl {
    /* ====================================================================
     *                         VAI TRÒ
     * ==================================================================== */
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    uint64 public constant MIN_ACCESS_DURATION = 1 hours;
    uint64 public constant MAX_ACCESS_DURATION = 30 days;
    uint64 public constant EMERGENCY_DURATION = 24 hours;

    /* ====================================================================
     *                         CẤU TRÚC DỮ LIỆU
     * ==================================================================== */
    struct FileRefs {
        string imageCid;
        bytes32 imageHash;
        string pdfCid;
        bytes32 pdfHash;
        string metadataCid;
        bytes32 metadataHash;
    }

    struct Record {
        uint256 id;
        address patient;
        address doctor;
        string imageCid;
        bytes32 imageHash;
        string pdfCid;
        bytes32 pdfHash;
        string metadataCid;
        bytes32 metadataHash;
        string patientWrappedKey;
        string escrowWrappedKey;
        bool signed;
        uint64 createdAt;
        uint256 previousRecordId;
    }

    struct Access {
        uint64 expiresAt;
        bool emergency;
        string wrappedKey;
    }

    uint256 public recordCount;
    mapping(uint256 => Record) private _records;
    mapping(address => uint256[]) private _patientRecords;
    mapping(uint256 => mapping(address => Access)) private _access;
    mapping(uint256 => address[]) private _grantees;
    mapping(uint256 => mapping(address => bool)) private _isGrantee;
    mapping(address => string) public publicKeys;

    // Social recovery
    mapping(address => address[]) private _guardians;
    mapping(address => uint8) public recoveryThreshold;
    mapping(address => uint256) public recoveryNonce;
    mapping(bytes32 => uint8) private _recoveryVotes;
    mapping(bytes32 => mapping(address => bool)) private _hasVoted;

    /* ====================================================================
     *                               EVENT
     * ==================================================================== */
    event PublicKeyRegistered(address indexed account);
    event RecordCreated(uint256 indexed id, address indexed patient, address indexed doctor, uint256 previousRecordId);
    event RecordUpdated(uint256 indexed id, address indexed doctor);
    event RecordSigned(uint256 indexed id, address indexed doctor, uint256 timestamp);
    event AccessRequested(uint256 indexed id, address indexed doctor, address indexed patient);
    event AccessGranted(uint256 indexed id, address indexed grantee, uint64 expiresAt);
    event AccessRevoked(uint256 indexed id, address indexed grantee);
    event RecordAccessed(uint256 indexed id, address indexed accessor, uint256 timestamp, bool emergency);
    event EmergencyAccessed(uint256 indexed id, address indexed doctor, string reason, uint64 expiresAt);
    event EmergencyKeyDelivered(uint256 indexed id, address indexed doctor, address indexed hospital);
    event GuardiansSet(address indexed patient, address[] guardians, uint8 threshold);
    event RecoveryApproved(address indexed oldWallet, address indexed newWallet, address indexed guardian, uint8 votes);
    event PatientRecovered(address indexed oldWallet, address indexed newWallet, uint256 recordCount);
    event PatientKeyRewrapped(uint256 indexed id, address indexed hospital);

    /* ====================================================================
     *                               LỖI
     * ==================================================================== */
    error RecordNotFound(uint256 id);
    error NotPatient();
    error NotRecordDoctor();
    error RecordAlreadySigned(uint256 id);
    error PublicKeyMissing(address account);
    error NotDoctor(address account);
    error InvalidDuration();
    error EmptyValue();
    error AccessDenied(uint256 id, address account);
    error NoActiveEmergency();
    error InvalidPreviousRecord();
    error InvalidFileKind();
    error InvalidGuardians();
    error NotGuardian();
    error AlreadyVoted();
    error InvalidAddress();

    /* ====================================================================
     *                     MODIFIER – CÁC RÀNG BUỘC LOGIC
     * ==================================================================== */
    modifier recordExists(uint256 id) {
        if (id == 0 || id > recordCount) revert RecordNotFound(id);
        _;
    }

    /// Ràng buộc 1: chỉ chủ hồ sơ (bệnh nhân) mới được cấp / thu hồi quyền
    modifier onlyPatient(uint256 id) {
        if (msg.sender != _records[id].patient) revert NotPatient();
        _;
    }

    modifier onlyRecordDoctor(uint256 id) {
        if (msg.sender != _records[id].doctor) revert NotRecordDoctor();
        _;
    }

    /// Ràng buộc 2: hồ sơ đã được bác sĩ ký thì không sửa được (bất biến)
    modifier notSigned(uint256 id) {
        if (_records[id].signed) revert RecordAlreadySigned(id);
        _;
    }

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _setRoleAdmin(DOCTOR_ROLE, HOSPITAL_ROLE);
    }

    /* ====================================================================
     *                         KHÓA CÔNG KHAI RSA
     * ==================================================================== */
    function registerPublicKey(string calldata pem) external {
        if (bytes(pem).length == 0) revert EmptyValue();
        publicKeys[msg.sender] = pem;
        emit PublicKeyRegistered(msg.sender);
    }

    /* ====================================================================
     *                 NGHIỆP VỤ 1 – ĐĂNG KÝ HỒ SƠ (Record Creation)
     * ==================================================================== */
    function createRecord(
        address patient,
        FileRefs calldata files,
        string calldata patientWrappedKey,
        string calldata escrowWrappedKey,
        uint256 previousRecordId
    ) external onlyRole(DOCTOR_ROLE) returns (uint256 id) {
        if (patient == address(0)) revert InvalidAddress();
        if (bytes(publicKeys[patient]).length == 0) revert PublicKeyMissing(patient);
        if (bytes(patientWrappedKey).length == 0) revert EmptyValue();
        if (previousRecordId != 0) {
            if (previousRecordId > recordCount || _records[previousRecordId].patient != patient) {
                revert InvalidPreviousRecord();
            }
        }

        id = ++recordCount;
        Record storage r = _records[id];
        r.id = id;
        r.patient = patient;
        r.doctor = msg.sender;
        _setFiles(r, files);
        r.patientWrappedKey = patientWrappedKey;
        r.escrowWrappedKey = escrowWrappedKey;
        r.createdAt = uint64(block.timestamp);
        r.previousRecordId = previousRecordId;
        _patientRecords[patient].push(id);

        emit RecordCreated(id, patient, msg.sender, previousRecordId);
    }

    /// Bác sĩ chỉ được sửa hồ sơ của mình khi CHƯA ký
    function updateRecord(
        uint256 id,
        FileRefs calldata files,
        string calldata patientWrappedKey,
        string calldata escrowWrappedKey
    ) external recordExists(id) onlyRecordDoctor(id) notSigned(id) {
        if (bytes(patientWrappedKey).length == 0) revert EmptyValue();
        Record storage r = _records[id];
        _setFiles(r, files);
        r.patientWrappedKey = patientWrappedKey;
        r.escrowWrappedKey = escrowWrappedKey;
        emit RecordUpdated(id, msg.sender);
    }

    /// Bác sĩ ký xác nhận – từ đây hồ sơ trở nên bất biến
    function signRecord(uint256 id) external recordExists(id) onlyRecordDoctor(id) notSigned(id) {
        _records[id].signed = true;
        emit RecordSigned(id, msg.sender, block.timestamp);
    }

    /* ====================================================================
     *            NGHIỆP VỤ 2 – CẤP QUYỀN TRUY CẬP (Access Authorization)
     * ==================================================================== */
    function requestAccess(uint256 id) external recordExists(id) onlyRole(DOCTOR_ROLE) {
        emit AccessRequested(id, msg.sender, _records[id].patient);
    }

    function grantAccess(
        uint256 id,
        address grantee,
        string calldata wrappedKey,
        uint64 duration
    ) external recordExists(id) onlyPatient(id) {
        if (!hasRole(DOCTOR_ROLE, grantee)) revert NotDoctor(grantee);
        if (duration < MIN_ACCESS_DURATION || duration > MAX_ACCESS_DURATION) revert InvalidDuration();
        if (bytes(wrappedKey).length == 0) revert EmptyValue();

        uint64 expiresAt = uint64(block.timestamp) + duration;
        _access[id][grantee] = Access({expiresAt: expiresAt, emergency: false, wrappedKey: wrappedKey});
        _addGrantee(id, grantee);
        emit AccessGranted(id, grantee, expiresAt);
    }

    function revokeAccess(uint256 id, address grantee) external recordExists(id) onlyPatient(id) {
        delete _access[id][grantee];
        emit AccessRevoked(id, grantee);
    }

    /// Giao dịch ghi nhật ký "ai xem, xem khi nào" trước khi lấy khóa giải mã
    function accessRecord(uint256 id) external recordExists(id) returns (string memory wrappedKey) {
        Record storage r = _records[id];
        bool emergency;

        if (msg.sender == r.patient) {
            wrappedKey = r.patientWrappedKey;
        } else {
            // Ràng buộc 3 + 4: phải còn là bác sĩ VÀ quyền còn hạn
            Access storage a = _access[id][msg.sender];
            if (
                !hasRole(DOCTOR_ROLE, msg.sender) ||
                a.expiresAt <= block.timestamp ||
                bytes(a.wrappedKey).length == 0
            ) {
                revert AccessDenied(id, msg.sender);
            }
            wrappedKey = a.wrappedKey;
            emergency = a.emergency;
        }

        emit RecordAccessed(id, msg.sender, block.timestamp, emergency);
    }

    /* ====================================================================
     *              NGHIỆP VỤ 3 – XÁC THỰC THÔNG TIN
     * ==================================================================== */
    /// kind: 0 = ảnh, 1 = PDF, 2 = metadata JSON
    function verifyFile(uint256 id, uint8 kind, bytes32 hash) external view recordExists(id) returns (bool) {
        Record storage r = _records[id];
        if (kind == 0) return r.imageHash == hash;
        if (kind == 1) return r.pdfHash == hash;
        if (kind == 2) return r.metadataHash == hash;
        revert InvalidFileKind();
    }

    /* ====================================================================
     *                MỞ RỘNG 1 – TRUY CẬP KHẨN CẤP
     * ==================================================================== */
    /// Bác sĩ mở quyền khẩn cấp 24 giờ khi bệnh nhân không thể tự cấp quyền
    function emergencyAccess(uint256 id, string calldata reason) external recordExists(id) onlyRole(DOCTOR_ROLE) {
        if (bytes(reason).length == 0) revert EmptyValue();
        uint64 expiresAt = uint64(block.timestamp) + EMERGENCY_DURATION;
        Access storage a = _access[id][msg.sender];
        a.expiresAt = expiresAt;
        a.emergency = true;
        _addGrantee(id, msg.sender);
        emit EmergencyAccessed(id, msg.sender, reason, expiresAt);
    }

    /// Bệnh viện mở khóa escrow và giao khóa AES (bọc cho bác sĩ cấp cứu)
    function deliverEmergencyKey(
        uint256 id,
        address doctor,
        string calldata wrappedKey
    ) external recordExists(id) onlyRole(HOSPITAL_ROLE) {
        Access storage a = _access[id][doctor];
        if (!a.emergency || a.expiresAt <= block.timestamp) revert NoActiveEmergency();
        if (bytes(wrappedKey).length == 0) revert EmptyValue();
        a.wrappedKey = wrappedKey;
        emit EmergencyKeyDelivered(id, doctor, msg.sender);
    }

    /* ====================================================================
     *            XỬ LÝ MẤT PRIVATE KEY – SOCIAL RECOVERY
     * ==================================================================== */
    function setGuardians(address[] calldata guardians, uint8 threshold) external {
        if (guardians.length == 0 || threshold == 0 || threshold > guardians.length) revert InvalidGuardians();
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == address(0) || guardians[i] == msg.sender) revert InvalidGuardians();
        }
        _guardians[msg.sender] = guardians;
        recoveryThreshold[msg.sender] = threshold;
        recoveryNonce[msg.sender]++;
        emit GuardiansSet(msg.sender, guardians, threshold);
    }

    function approveRecovery(address oldWallet, address newWallet) external {
        if (!_isGuardianOf(oldWallet, msg.sender)) revert NotGuardian();
        if (newWallet == address(0) || newWallet == oldWallet) revert InvalidAddress();

        bytes32 key = keccak256(abi.encode(oldWallet, newWallet, recoveryNonce[oldWallet]));
        if (_hasVoted[key][msg.sender]) revert AlreadyVoted();
        _hasVoted[key][msg.sender] = true;
        uint8 votes = ++_recoveryVotes[key];
        emit RecoveryApproved(oldWallet, newWallet, msg.sender, votes);

        if (votes >= recoveryThreshold[oldWallet]) {
            _executeRecovery(oldWallet, newWallet);
        }
    }

    /// Sau khi khôi phục: bệnh viện mở bản escrow và bọc lại khóa AES cho ví mới
    function rewrapPatientKey(uint256 id, string calldata newWrappedKey) external recordExists(id) onlyRole(HOSPITAL_ROLE) {
        if (bytes(newWrappedKey).length == 0) revert EmptyValue();
        _records[id].patientWrappedKey = newWrappedKey;
        emit PatientKeyRewrapped(id, msg.sender);
    }

    /* ====================================================================
     *                           HÀM ĐỌC
     * ==================================================================== */
    function getRecord(uint256 id) external view recordExists(id) returns (Record memory) {
        return _records[id];
    }

    function getPatientRecords(address patient) external view returns (uint256[] memory) {
        return _patientRecords[patient];
    }

    function getAccess(uint256 id, address user) external view returns (Access memory) {
        return _access[id][user];
    }

    function getGrantees(uint256 id) external view returns (address[] memory) {
        return _grantees[id];
    }

    function hasAccess(uint256 id, address user) external view recordExists(id) returns (bool) {
        if (user == _records[id].patient) return true;
        Access storage a = _access[id][user];
        return hasRole(DOCTOR_ROLE, user) && a.expiresAt > block.timestamp && bytes(a.wrappedKey).length > 0;
    }

    function getGuardians(address patient) external view returns (address[] memory, uint8) {
        return (_guardians[patient], recoveryThreshold[patient]);
    }

    /* ====================================================================
     *                           HÀM NỘI BỘ
     * ==================================================================== */
    function _setFiles(Record storage r, FileRefs calldata f) private {
        if (bytes(f.imageCid).length == 0 || bytes(f.pdfCid).length == 0 || bytes(f.metadataCid).length == 0) {
            revert EmptyValue();
        }
        r.imageCid = f.imageCid;
        r.imageHash = f.imageHash;
        r.pdfCid = f.pdfCid;
        r.pdfHash = f.pdfHash;
        r.metadataCid = f.metadataCid;
        r.metadataHash = f.metadataHash;
    }

    function _addGrantee(uint256 id, address grantee) private {
        if (!_isGrantee[id][grantee]) {
            _isGrantee[id][grantee] = true;
            _grantees[id].push(grantee);
        }
    }

    function _isGuardianOf(address patient, address account) private view returns (bool) {
        address[] storage g = _guardians[patient];
        for (uint256 i = 0; i < g.length; i++) {
            if (g[i] == account) return true;
        }
        return false;
    }

    function _executeRecovery(address oldWallet, address newWallet) private {
        uint256[] storage ids = _patientRecords[oldWallet];
        uint256 n = ids.length;
        for (uint256 i = 0; i < n; i++) {
            _records[ids[i]].patient = newWallet;
            _patientRecords[newWallet].push(ids[i]);
        }
        delete _patientRecords[oldWallet];

        // Người giám hộ được chuyển sang ví mới
        _guardians[newWallet] = _guardians[oldWallet];
        recoveryThreshold[newWallet] = recoveryThreshold[oldWallet];
        delete _guardians[oldWallet];
        delete recoveryThreshold[oldWallet];
        recoveryNonce[oldWallet]++;

        emit PatientRecovered(oldWallet, newWallet, n);
    }
}
