# Thiết kế hệ thống DHR

Tài liệu chốt kiến trúc, phân quyền (RBAC), interface smart contract và các luồng nghiệp vụ.
A và B làm theo đúng interface này để code song song.

## 1. Sơ đồ kiến trúc tổng thể

```mermaid
flowchart LR
    subgraph U["Người dùng (trình duyệt + MetaMask)"]
        P["Bệnh nhân<br/>/patient"]
        D["Bác sĩ<br/>/doctor"]
        H["Bệnh viện<br/>/hospital"]
        V["Bảo hiểm / Nhà tuyển dụng<br/>/verify"]
    end

    subgraph FE["Frontend Next.js"]
        UI["Giao diện React + TailwindCSS"]
        CR["lib/crypto.ts<br/>AES-256-GCM · RSA-OAEP · SHA-256"]
        API["API route /api/ipfs<br/>(giữ Pinata JWT phía server)"]
    end

    subgraph BC["Ethereum Sepolia"]
        MR["MedicalRecord.sol<br/>RBAC · hồ sơ · quyền · nhật ký<br/>truy cập khẩn cấp · social recovery"]
        SBT["MedicalSBT.sol<br/>ERC-721 Soulbound"]
    end

    IPFS[("IPFS qua Pinata<br/>ảnh · PDF · JSON đã mã hóa")]

    P & D & H & V --> UI
    UI --> CR
    UI -- "ethers.js + MetaMask<br/>(giao dịch, đọc dữ liệu, event)" --> MR
    UI -- "ethers.js" --> SBT
    CR -- "file đã mã hóa" --> API
    API -- "upload / retrieve theo CID" --> IPFS
```

Nguyên tắc riêng tư: **trên blockchain chỉ có địa chỉ ví, CID, mã băm SHA-256 và khóa AES đã bọc RSA**. Không có tên, địa chỉ, số điện thoại. Mọi file trên IPFS đều đã mã hóa AES-256-GCM.

## 2. Ma trận phân quyền (RBAC)

| Chức năng | Admin | Hospital | Doctor | Patient (chủ hồ sơ) | Verifier |
| --- | :---: | :---: | :---: | :---: | :---: |
| Cấp vai trò Hospital / Verifier | ✅ | | | | |
| Cấp vai trò Doctor | | ✅ | | | |
| Đăng ký RSA public key | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo hồ sơ (`createRecord`) | | | ✅ | | |
| Sửa hồ sơ khi chưa ký (`updateRecord`) | | | ✅ (bác sĩ tạo) | | |
| Ký xác nhận (`signRecord`) | | | ✅ (bác sĩ tạo) | | |
| Yêu cầu quyền xem (`requestAccess`) | | | ✅ | | |
| Cấp / thu hồi quyền (`grantAccess` / `revokeAccess`) | | | | ✅ | |
| Xem hồ sơ (`accessRecord`) | | | ✅ (khi còn hạn) | ✅ | |
| Truy cập khẩn cấp (`emergencyAccess`) | | | ✅ | | |
| Giao khóa khẩn cấp (`deliverEmergencyKey`) | | ✅ | | | |
| Chỉ định người giám hộ (`setGuardians`) | | | | ✅ | |
| Phê duyệt khôi phục ví (`approveRecovery`) | | | | Người giám hộ | |
| Mint / thu hồi SBT | | ✅ | | | |
| Xác thực SBT (`hasValidCertificate`) | ✅ | ✅ | ✅ | ✅ | ✅ |

Cài đặt bằng `AccessControl` của OpenZeppelin: `DEFAULT_ADMIN_ROLE`, `HOSPITAL_ROLE`, `DOCTOR_ROLE`, `VERIFIER_ROLE`. Vai trò quản trị của `DOCTOR_ROLE` là `HOSPITAL_ROLE`, nên bệnh viện tự cấp quyền cho bác sĩ. "Bệnh nhân" không phải vai trò mà là **chủ sở hữu từng hồ sơ** (`record.patient`).

## 3. Interface smart contract

### 3.1. `MedicalRecord.sol`

**Dữ liệu chính**

```solidity
struct Record {
    uint256 id;
    address patient;            // chủ sở hữu hồ sơ
    address doctor;             // bác sĩ tạo hồ sơ
    string  imageCid;   bytes32 imageHash;      // ảnh X-quang / siêu âm
    string  pdfCid;     bytes32 pdfHash;        // PDF tóm tắt bệnh án
    string  metadataCid; bytes32 metadataHash;  // JSON nhân trắc học
    string  patientWrappedKey;  // khóa AES bọc bằng RSA public key bệnh nhân
    string  escrowWrappedKey;   // khóa AES bọc bằng RSA public key bệnh viện (dự phòng mất khóa / cấp cứu)
    bool    signed;             // đã ký => bất biến
    uint64  createdAt;
    uint256 previousRecordId;   // 0 nếu là bản đầu tiên
}

struct Access {
    uint64 expiresAt;           // 0 = không có quyền
    bool   emergency;           // true nếu là truy cập khẩn cấp
    string wrappedKey;          // khóa AES bọc bằng RSA public key người được cấp
}
```

**Hàm**

| Hàm | Ai gọi | Ràng buộc chính |
| --- | --- | --- |
| `registerPublicKey(string pem)` | Mọi người | — |
| `createRecord(address patient, FileRefs files, string patientWrappedKey, string escrowWrappedKey, uint256 previousRecordId) → id` | Doctor | `onlyRole(DOCTOR_ROLE)`; bệnh nhân đã đăng ký public key |
| `updateRecord(uint256 id, FileRefs files, string patientWrappedKey, string escrowWrappedKey)` | Doctor tạo hồ sơ | **`notSigned`** |
| `signRecord(uint256 id)` | Doctor tạo hồ sơ | **`notSigned`** |
| `requestAccess(uint256 id)` | Doctor | `onlyRole(DOCTOR_ROLE)` |
| `grantAccess(uint256 id, address grantee, string wrappedKey, uint64 duration)` | Bệnh nhân | **`onlyPatient`**; grantee là Doctor; 1 giờ ≤ duration ≤ 30 ngày |
| `revokeAccess(uint256 id, address grantee)` | Bệnh nhân | **`onlyPatient`** |
| `accessRecord(uint256 id)` (giao dịch, ghi nhật ký) | Bệnh nhân / Doctor | **quyền còn hạn** |
| `emergencyAccess(uint256 id, string reason)` | Doctor | quyền 24 giờ, đánh dấu khẩn cấp |
| `deliverEmergencyKey(uint256 id, address doctor, string wrappedKey)` | Hospital | doctor đang có quyền khẩn cấp còn hạn |
| `setGuardians(address[] guardians, uint8 threshold)` | Bệnh nhân | 1 ≤ threshold ≤ số người giám hộ |
| `approveRecovery(address oldWallet, address newWallet)` | Người giám hộ | đủ `threshold` phiếu thì chuyển toàn bộ hồ sơ sang ví mới |
| `rewrapPatientKey(uint256 id, string newWrappedKey)` | Hospital | dùng sau khôi phục: bọc lại khóa AES cho ví mới từ bản escrow |
| `getRecord(uint256 id) view` | Mọi người | — |
| `getPatientRecords(address patient) view` | Mọi người | — |
| `getAccess(uint256 id, address user) view` | Mọi người | — |
| `verifyFile(uint256 id, uint8 kind, bytes32 hash) view → bool` | Mọi người | kind: 0 ảnh, 1 PDF, 2 JSON |

`FileRefs` = `{ imageCid, imageHash, pdfCid, pdfHash, metadataCid, metadataHash }`.

**Event**: `PublicKeyRegistered`, `RecordCreated`, `RecordUpdated`, `RecordSigned`, `AccessRequested`, `AccessGranted`, `AccessRevoked`, `RecordAccessed(id, accessor, timestamp, emergency)`, `EmergencyAccessed(id, doctor, reason, expiresAt)`, `EmergencyKeyDelivered`, `GuardiansSet`, `RecoveryApproved`, `PatientRecovered`.

### 3.2. `MedicalSBT.sol`

| Hàm | Ai gọi | Ghi chú |
| --- | --- | --- |
| `mint(address patient, string certType, uint64 expiresAt, string uri) → tokenId` | Hospital | Ví dụ certType: `HEALTH_CHECK_OK`, `VACCINATION_HEPB` |
| `revoke(uint256 tokenId)` | Hospital | Đốt token |
| `hasValidCertificate(address patient, string certType) view → bool` | Mọi người | Chỉ trả về đúng/sai, không lộ bệnh lý |
| `locked(uint256 tokenId) view → bool` | Mọi người | Luôn `true` (chuẩn ERC-5192) |
| `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` | — | **Luôn revert** (Soulbound) |

### 3.3. Các ràng buộc logic

1. **`onlyPatient`**: chỉ chủ hồ sơ mới cấp hoặc thu hồi quyền.
2. **`notSigned`**: hồ sơ đã được bác sĩ ký thì không sửa được nữa; muốn đính chính phải tạo bản mới trỏ về `previousRecordId`.
3. **Quyền có thời hạn**: `accessRecord` kiểm tra `block.timestamp < expiresAt`.
4. **Kiểm tra vai trò**: `onlyRole(...)` trên các hàm nhạy cảm.
5. **Soulbound**: mọi thao tác chuyển nhượng SBT đều revert.

## 4. Sơ đồ tuần tự

### 4.1. Tạo hồ sơ

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ
    participant FE as Frontend
    participant IPFS as IPFS (Pinata)
    participant SC as MedicalRecord
    BS->>FE: Chọn ảnh, PDF, nhập chỉ số nhân trắc
    FE->>SC: Đọc RSA public key của bệnh nhân và bệnh viện
    FE->>FE: Tính SHA-256 từng file gốc
    FE->>FE: Tạo khóa AES ngẫu nhiên, mã hóa 3 file (AES-256-GCM)
    FE->>IPFS: Upload 3 file đã mã hóa
    IPFS-->>FE: 3 CID
    FE->>FE: Bọc khóa AES bằng public key bệnh nhân và bệnh viện
    BS->>SC: createRecord(patient, CID + hash, khóa đã bọc)
    SC-->>FE: event RecordCreated(id)
    BS->>SC: signRecord(id)
    SC-->>FE: event RecordSigned(id) – hồ sơ trở nên bất biến
```

### 4.2. Yêu cầu, cấp và thu hồi quyền

```mermaid
sequenceDiagram
    autonumber
    actor BS2 as Bác sĩ 2
    actor BN as Bệnh nhân
    participant FE as Frontend
    participant SC as MedicalRecord
    BS2->>SC: requestAccess(id)
    SC-->>FE: event AccessRequested
    FE-->>BN: Hiện yêu cầu chờ duyệt
    BN->>FE: Duyệt, chọn thời hạn (vd 7 ngày)
    FE->>SC: Đọc patientWrappedKey + public key Bác sĩ 2
    FE->>FE: Mở khóa AES bằng private key bệnh nhân,<br/>bọc lại bằng public key Bác sĩ 2
    BN->>SC: grantAccess(id, BS2, wrappedKey, 7 ngày)
    SC-->>FE: event AccessGranted
    Note over BN,SC: Khi muốn dừng chia sẻ
    BN->>SC: revokeAccess(id, BS2)
    SC-->>FE: event AccessRevoked
```

### 4.3. Bác sĩ xem hồ sơ (retrieve)

```mermaid
sequenceDiagram
    autonumber
    actor BS2 as Bác sĩ 2
    participant FE as Frontend
    participant SC as MedicalRecord
    participant IPFS as IPFS (Pinata)
    BS2->>SC: accessRecord(id) – giao dịch
    SC->>SC: Kiểm tra quyền còn hạn
    SC-->>FE: event RecordAccessed (ghi nhật ký: ai, khi nào)
    FE->>SC: getAccess(id, BS2) → wrappedKey, getRecord(id) → CID + hash
    FE->>IPFS: Tải 3 file đã mã hóa theo CID
    FE->>FE: Mở khóa AES bằng private key Bác sĩ 2, giải mã
    FE->>FE: Tính SHA-256 so với hash on-chain (kiểm tra toàn vẹn)
    FE-->>BS2: Hiển thị ảnh, PDF, chỉ số
```

### 4.4. Cấp và xác thực chứng nhận SBT

```mermaid
sequenceDiagram
    autonumber
    actor BV as Bệnh viện
    actor BN as Bệnh nhân
    actor BH as Bảo hiểm / Nhà tuyển dụng
    participant SBT as MedicalSBT
    BV->>SBT: mint(BN, "HEALTH_CHECK_OK", hạn, uri)
    SBT-->>BN: Token gắn vĩnh viễn với ví bệnh nhân
    BN-xSBT: transferFrom(...) → revert: Soulbound
    BH->>SBT: hasValidCertificate(BN, "HEALTH_CHECK_OK")
    SBT-->>BH: true / false (không lộ dữ liệu bệnh lý)
```

### 4.5. Khôi phục khi bệnh nhân mất private key

```mermaid
sequenceDiagram
    autonumber
    actor BN as Bệnh nhân
    actor G1 as Người giám hộ 1
    actor G2 as Người giám hộ 2
    actor BV as Bệnh viện
    participant SC as MedicalRecord
    BN->>SC: setGuardians([G1, G2, BV], threshold = 2)
    Note over BN: Mất private key, tạo ví mới
    G1->>SC: approveRecovery(víCũ, víMới)
    G2->>SC: approveRecovery(víCũ, víMới)
    SC->>SC: Đủ 2/3 phiếu → chuyển toàn bộ hồ sơ sang ví mới
    SC-->>BN: event PatientRecovered
    BV->>SC: Đọc escrowWrappedKey, mở bằng khóa bệnh viện,<br/>bọc lại bằng public key ví mới
    BV->>SC: rewrapPatientKey(id, khóa mới)
```

### 4.6. Truy cập khẩn cấp (mở rộng)

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ cấp cứu
    actor BV as Bệnh viện
    actor BN as Bệnh nhân
    participant SC as MedicalRecord
    BS->>SC: emergencyAccess(id, "Bệnh nhân bất tỉnh")
    SC-->>BN: event EmergencyAccessed – cảnh báo trên dashboard
    BV->>SC: deliverEmergencyKey(id, BS, khóa AES bọc cho BS)
    BS->>SC: accessRecord(id) – nhật ký đánh dấu KHẨN CẤP
    Note over BS,SC: Quyền tự hết hạn sau 24 giờ
```
