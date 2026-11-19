# Kết quả kiểm thử trên Sepolia và phân tích chi phí gas

Kịch bản `contracts/scripts/demo-sepolia.ts` chạy ngày **19/11/2026, khoảng 12:45 UTC (19:45 giờ Việt Nam)**, gồm 15 giao dịch trên mạng **Ethereum Sepolia** (chainId `11155111`), block khoảng `12168480`–`12168500`.

- Kết quả: **11 giao dịch thành công** và **4 giao dịch bị chặn đúng như thiết kế**. Không có lỗi ngoài dự kiến.
- MedicalRecord: [`0xDaDF4E8C45bD465F49d5237b90CdFADD9ada6C57`](https://sepolia.etherscan.io/address/0xDaDF4E8C45bD465F49d5237b90CdFADD9ada6C57)
- MedicalSBT: [`0xD717eA261CdCBd308d1F558D572FBa6fa161381f`](https://sepolia.etherscan.io/address/0xD717eA261CdCBd308d1F558D572FBa6fa161381f)
- Dữ liệu dùng trong kịch bản (CID, khóa đã bọc) là dữ liệu kiểm thử, không phải hồ sơ thật.

## 1. Khái niệm

| Thuật ngữ | Ý nghĩa |
| --- | --- |
| **Gas (gas used)** | Lượng "công việc tính toán" mà một giao dịch tiêu tốn. Phụ thuộc vào code của hàm, không phụ thuộc giá ETH. |
| **Giá gas (gas price)** | Số ETH trả cho mỗi đơn vị gas, tính bằng Gwei (1 Gwei = 0,000000001 ETH). Trên Sepolia các giao dịch của nhóm có giá **1 Gwei**. |
| **Phí giao dịch** | Phí = Gas used × Giá gas. Ví dụ: 24.629 gas × 1 Gwei = 0,000024629 SepoliaETH. |
| **SepoliaETH** | ETH thử nghiệm, không có giá trị thật. Dùng để trả phí giao dịch trên Sepolia. |

Giao dịch bị chặn (revert) **vẫn mất phí** cho phần gas đã chạy trước khi bị chặn. Vì vậy giao diện DApp chạy thử (`staticCall`) trước khi gửi để tránh tốn phí và tránh lỗi khi demo.

## 2. Cấp SepoliaETH cho các ví

Ví `Admin-BenhVien` nhận SepoliaETH từ Sepolia PoW Faucet (pk910), sau đó ngày 17/11/2026 chuyển cho các ví còn lại để trả phí giao dịch:

| Ví | Vai trò | SepoliaETH được cấp |
| --- | --- | ---: |
| BacSi-1 | Bác sĩ tạo hồ sơ | 0,01 |
| BacSi-2 | Bác sĩ xin quyền / cấp cứu | 0,01 |
| BenhNhan | Bệnh nhân | 0,01 |
| BaoHiem | Bảo hiểm / nhà tuyển dụng | 0,005 |

## 3. Chi tiết 15 giao dịch

| Bước | Nội dung | Ví gọi | Hàm | Kết quả | Gas used | Phí (SepoliaETH) | Giao dịch |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
| 1 | Đăng ký public key | BenhNhan | `registerPublicKey` | ✅ Thành công | 128,071 | 0.000128 | [0x2dad5c7c…](https://sepolia.etherscan.io/tx/0x2dad5c7c55453142cc58ed93b2b5d16463362a53c49625a32c9992b953fb0bd8) |
| 2 | Tạo hồ sơ (hồ sơ số 1) | BacSi-1 | `createRecord` | ✅ Thành công | 1,685,697 | 0.001686 | [0xdf082bae…](https://sepolia.etherscan.io/tx/0xdf082baed22e5ad59df3e014c246dc90b92b9c4681c98e4825623aa5bfdcf4a3) |
| 3 | Ký xác nhận hồ sơ | BacSi-1 | `signRecord` | ✅ Thành công | 34,256 | 0.000034 | [0x12684d0d…](https://sepolia.etherscan.io/tx/0x12684d0d434093e0c7fd5f318cdb1a25df958e102adec5c8f181b615043a6ac8) |
| 4 | Yêu cầu quyền xem | BacSi-2 | `requestAccess` | ✅ Thành công | 24,205 | 0.000024 | [0x5bf6daec…](https://sepolia.etherscan.io/tx/0x5bf6daec2ef76c6e7cbc9f46c691f61f4a0686dc2b258bdad3c82e0336cec35b) |
| 5 | Cấp quyền 7 ngày | BenhNhan | `grantAccess` | ✅ Thành công | 578,093 | 0.000578 | [0xab0d0cc8…](https://sepolia.etherscan.io/tx/0xab0d0cc89f2c56dfab1eeae61817fd8b3e73ff81cf27329400512cb5d0c6fc6e) |
| 6 | Xem hồ sơ (ghi nhật ký) | BacSi-2 | `accessRecord` | ✅ Thành công | 30,001 | 0.000030 | [0x6449d0a5…](https://sepolia.etherscan.io/tx/0x6449d0a55dece8fa725328717d91e6480991618085f44de5250669d592cff08a) |
| 7 | Thu hồi quyền | BenhNhan | `revokeAccess` | ✅ Thành công | 37,345 | 0.000037 | [0x3878461a…](https://sepolia.etherscan.io/tx/0x3878461a81d88949b630b43428643d9f47ced888c4d7dc8ed37cc2b7e3179d50) |
| 8 | [Ràng buộc] Xem sau khi bị thu hồi | BacSi-2 | `accessRecord` | ⛔ Bị chặn: `AccessDenied(id=1, account=BacSi-2)` | 24,629 | 0.000025 | [0xc5859582…](https://sepolia.etherscan.io/tx/0xc5859582cab260c8d8fc16f7211b85d13779f38eef1b1655497f4b7a1f8383c4) |
| 9 | [Ràng buộc] Người không phải chủ hồ sơ cấp quyền | BacSi-2 | `grantAccess` | ⛔ Bị chặn: `NotPatient()` | 27,544 | 0.000028 | [0xc21d9032…](https://sepolia.etherscan.io/tx/0xc21d9032ab921863b204168b7f67caa5d2b0a7dbe8e082066c25e3a98629a5b8) |
| 10 | [Ràng buộc] Sửa hồ sơ đã ký | BacSi-1 | `updateRecord` | ⛔ Bị chặn: `RecordAlreadySigned(id=1)` | 56,216 | 0.000056 | [0xb9df805c…](https://sepolia.etherscan.io/tx/0xb9df805cad06cceaac1237134a478ae058de95bd98ab59e0564efe08a36865ae) |
| 11 | Mở truy cập khẩn cấp | BacSi-2 | `emergencyAccess` | ✅ Thành công | 136,563 | 0.000137 | [0x3a6de823…](https://sepolia.etherscan.io/tx/0x3a6de823a9e348314aaffa6e758f0e56f385c85e30c7fad8f10f7f4ad4e4a9fe) |
| 12 | Bệnh viện giao khóa khẩn cấp | Admin-BenhVien | `deliverEmergencyKey` | ✅ Thành công | 136,346 | 0.000136 | [0x42d48b6b…](https://sepolia.etherscan.io/tx/0x42d48b6b43f1dbfe0d8beb80752e91af47026fd151b2d0d7630af065635a7e63) |
| 13 | Xem hồ sơ (khẩn cấp) – event `RecordAccessed` có `emergency = True` | BacSi-2 | `accessRecord` | ✅ Thành công | 30,001 | 0.000030 | [0x73b8c739…](https://sepolia.etherscan.io/tx/0x73b8c739e2d5be6cf0de4685aec3e4b1d4e9906a18a426232da364bd41688336) |
| 14 | Cấp chứng nhận SBT (token số 1) | Admin-BenhVien | `mint` | ✅ Thành công | 811,962 | 0.000812 | [0x38fc82c9…](https://sepolia.etherscan.io/tx/0x38fc82c9368db60f885cc8d86ad64d01fe96a12c1693518068ed433f44f7ddd3) |
| 15 | [Ràng buộc] Chuyển nhượng SBT | BenhNhan | `transferFrom` | ⛔ Bị chặn: `Soulbound()` | 21,400 | 0.000021 | [0xa237a840…](https://sepolia.etherscan.io/tx/0xa237a840336fe242277fe528a8c627bdc5b85d06702431dd4bbeae3f7339dab6) |

Các lệnh đọc dữ liệu (`verifyFile`, `hasValidCertificate`) không tạo giao dịch nên **không tốn gas**:
- `verifyFile(ảnh, hash đúng)` = `true`; `verifyFile(ảnh, hash sai)` = `false`.
- `hasValidCertificate(BenhNhan, "HEALTH_CHECK_OK")` do ví BaoHiem gọi = `true`.

Phí của 4 giao dịch bị chặn lấy từ mục *Transaction Fee* trên Etherscan. Phí của giao dịch thành công tính theo giá gas 1 Gwei.

## 4. Tổng phí theo từng ví

| Ví | Số giao dịch | Tổng gas used | Tổng phí (SepoliaETH) |
| --- | ---: | ---: | ---: |
| BacSi-1 | 3 | 1,776,169 | 0.001776 |
| Admin-BenhVien | 2 | 948,308 | 0.000948 |
| BenhNhan | 4 | 764,909 | 0.000765 |
| BacSi-2 | 6 | 272,943 | 0.000273 |
| BaoHiem | 0 | 0 | 0 |
| **Tổng** | **15** | **3,762,329** | **0.003762** |

Không ví nào dùng quá 20% số SepoliaETH được cấp.

## 5. Ước tính chi phí nếu triển khai trên Ethereum mainnet (mở rộng)

Giá ETH: **$1,806.40** (Coinbase, 19/11/2026). Chi phí = Gas used × Giá gas × Giá ETH. Tính theo 2 kịch bản giá gas: **0,15 Gwei** (mức thông thường ngày 19/11/2026) và **20 Gwei** (khi mạng tắc nghẽn).

| Nghiệp vụ | Hàm | Gas used | Chi phí @ 0,15 Gwei | Chi phí @ 20 Gwei |
| --- | --- | ---: | ---: | ---: |
| Tạo hồ sơ | `createRecord` | 1,685,697 | $0.4568 | $60.90 |
| Cấp chứng nhận SBT | `mint` | 811,962 | $0.2200 | $29.33 |
| Cấp quyền 7 ngày | `grantAccess` | 578,093 | $0.1566 | $20.89 |
| Mở truy cập khẩn cấp | `emergencyAccess` | 136,563 | $0.0370 | $4.93 |
| Giao khóa khẩn cấp | `deliverEmergencyKey` | 136,346 | $0.0369 | $4.93 |
| Đăng ký public key | `registerPublicKey` | 128,071 | $0.0347 | $4.63 |
| Thu hồi quyền | `revokeAccess` | 37,345 | $0.0101 | $1.35 |
| Ký xác nhận | `signRecord` | 34,256 | $0.0093 | $1.24 |
| Xem hồ sơ (ghi nhật ký) | `accessRecord` | 30,001 | $0.0081 | $1.08 |
| Yêu cầu quyền | `requestAccess` | 24,205 | $0.0066 | $0.87 |

## 6. Nhận xét

- `createRecord`, `mint` và `grantAccess` tốn gas nhất vì phải ghi chuỗi (CID, khóa AES đã bọc, loại chứng nhận, URI) vào storage. Mỗi ô nhớ 32 byte mới tốn khoảng 20.000 gas.
- Các thao tác diễn ra thường xuyên (xem hồ sơ, ký, thu hồi, yêu cầu quyền) đều dưới 40.000 gas, chưa tới $0,01 ở mức giá gas thông thường.
- Khóa AES bọc bằng RSA-2048 thật dài khoảng 344 ký tự base64, dài hơn chuỗi kiểm thử, nên chi phí thực tế của `createRecord` và `grantAccess` sẽ cao hơn bảng trên.
- Hướng tối ưu: lưu khóa đã bọc trong event hoặc trên IPFS thay vì storage; hoặc triển khai trên mạng Layer 2 (Arbitrum, Optimism, Base) có phí thấp hơn nhiều so với Ethereum mainnet.