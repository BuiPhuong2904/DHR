# Triển khai trên Sepolia

- Mạng: **Ethereum Sepolia Testnet** (chainId `11155111`)
- Công cụ: Hardhat 3 + Hardhat Ignition (module `DHRModule`)
- Ví deploy (Admin + Bệnh viện): `0xfe185C1FA620699Fe6eaAA001828cAfa37668498`
- Block deploy: `12161659`

## Địa chỉ contract

| Contract | Địa chỉ | Etherscan (đã verify) | Sourcify |
| --- | --- | --- | --- |
| MedicalRecord | `0xDaDF4E8C45bD465F49d5237b90CdFADD9ada6C57` | [Xem](https://sepolia.etherscan.io/address/0xDaDF4E8C45bD465F49d5237b90CdFADD9ada6C57#code) | [Xem](https://sourcify.dev/server/repo-ui/11155111/0xDaDF4E8C45bD465F49d5237b90CdFADD9ada6C57) |
| MedicalSBT | `0xD717eA261CdCBd308d1F558D572FBa6fa161381f` | [Xem](https://sepolia.etherscan.io/address/0xD717eA261CdCBd308d1F558D572FBa6fa161381f#code) | [Xem](https://sourcify.dev/server/repo-ui/11155111/0xD717eA261CdCBd308d1F558D572FBa6fa161381f) |

## Vai trò đã cấp khi deploy

| Contract | Vai trò | Ví | Tên ví |
| --- | --- | --- | --- |
| MedicalRecord | DEFAULT_ADMIN_ROLE, HOSPITAL_ROLE | `0xfe185C1FA620699Fe6eaAA001828cAfa37668498` | Admin-BenhVien |
| MedicalRecord | DOCTOR_ROLE | `0xfF2DFd48C2506ed60A6317171425fec95a3D51e4` | BacSi-1 |
| MedicalRecord | DOCTOR_ROLE | `0xFF90d71e01F8c302552A55e4c72F649992F2E5ed` | BacSi-2 |
| MedicalRecord | VERIFIER_ROLE | `0x2125b085aab175Ce5e63BfacE4acDB4b77eCBBbC` | BaoHiem |
| MedicalSBT | DEFAULT_ADMIN_ROLE, HOSPITAL_ROLE | `0xfe185C1FA620699Fe6eaAA001828cAfa37668498` | Admin-BenhVien |
