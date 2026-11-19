import { network } from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";

const { ethers } = await network.create();
const [admin, doctor1, doctor2, patient, insurer] = await ethers.getSigners();

const deployed = JSON.parse(
  readFileSync("ignition/deployments/chain-11155111/deployed_addresses.json", "utf8"),
);
const mr = await ethers.getContractAt("MedicalRecord", deployed["DHRModule#MedicalRecord"]);
const sbt = await ethers.getContractAt("MedicalSBT", deployed["DHRModule#MedicalSBT"]);

const TX_URL = "https://sepolia.etherscan.io/tx/";
const DAY = 24 * 60 * 60;
const MUST_FAIL = { gasLimit: 300_000n };

type Row = { step: string; caller: string; fn: string; result: string; gasUsed: string; tx: string };
const rows: Row[] = [];

async function send(step: string, caller: string, fn: string, txPromise: Promise<any>, expectFail = false) {
  const tx = await txPromise;
  try {
    const receipt = await tx.wait();
    rows.push({ step, caller, fn, result: "Thành công", gasUsed: receipt.gasUsed.toString(), tx: tx.hash });
    console.log(`✅ ${step} | gas ${receipt.gasUsed} | ${TX_URL}${tx.hash}`);
    return receipt;
  } catch {
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const result = expectFail ? "Bị chặn đúng như mong đợi" : "LỖI NGOÀI DỰ KIẾN";
    rows.push({ step, caller, fn, result, gasUsed: receipt?.gasUsed?.toString() ?? "-", tx: tx.hash });
    console.log(`${expectFail ? "⛔" : "❌"} ${step} | ${result} | ${TX_URL}${tx.hash}`);
    return null;
  }
}

function findEvent(contract: any, receipt: any, name: string) {
  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === name) return parsed;
  }
  throw new Error(`Không thấy event ${name}`);
}

const files = (tag: string) => ({
  imageCid: `demo-image-${tag}`,
  imageHash: ethers.id(`image-${tag}`),
  pdfCid: `demo-pdf-${tag}`,
  pdfHash: ethers.id(`pdf-${tag}`),
  metadataCid: `demo-meta-${tag}`,
  metadataHash: ethers.id(`meta-${tag}`),
});

console.log("=== KỊCH BẢN KIỂM THỬ DHR TRÊN SEPOLIA ===\n");

// 1. Bệnh nhân đăng ký public key
await send("1. Đăng ký public key", "BenhNhan", "registerPublicKey",
  mr.connect(patient).registerPublicKey("DEMO-PUBLIC-KEY-BENH-NHAN"));

// 2. Bác sĩ 1 tạo hồ sơ và ký
const created = await send("2. Tạo hồ sơ", "BacSi-1", "createRecord",
  mr.connect(doctor1).createRecord(patient.address, files("demo"), "DEMO-WRAPPED-PATIENT", "DEMO-WRAPPED-HOSPITAL", 0));
const id = findEvent(mr, created, "RecordCreated").args.id;
console.log(`   -> Hồ sơ số ${id}`);
await send("3. Ký xác nhận hồ sơ", "BacSi-1", "signRecord", mr.connect(doctor1).signRecord(id));

// 3. Yêu cầu – cấp – xem – thu hồi
await send("4. Yêu cầu quyền xem", "BacSi-2", "requestAccess", mr.connect(doctor2).requestAccess(id));
await send("5. Cấp quyền 7 ngày", "BenhNhan", "grantAccess",
  mr.connect(patient).grantAccess(id, doctor2.address, "DEMO-WRAPPED-DOCTOR2", 7 * DAY));
await send("6. Xem hồ sơ (ghi nhật ký)", "BacSi-2", "accessRecord", mr.connect(doctor2).accessRecord(id));
console.log(`   -> verifyFile(ảnh, hash đúng) = ${await mr.verifyFile(id, 0, ethers.id("image-demo"))}`);
console.log(`   -> verifyFile(ảnh, hash sai)  = ${await mr.verifyFile(id, 0, ethers.id("image-bi-sua"))}`);
await send("7. Thu hồi quyền", "BenhNhan", "revokeAccess", mr.connect(patient).revokeAccess(id, doctor2.address));

// 4. Cố tình vi phạm ràng buộc (giao dịch phải bị revert)
await send("8. [Ràng buộc] Xem sau khi bị thu hồi", "BacSi-2", "accessRecord",
  mr.connect(doctor2).accessRecord(id, MUST_FAIL), true);
await send("9. [Ràng buộc] Người không phải chủ hồ sơ cấp quyền", "BacSi-2", "grantAccess",
  mr.connect(doctor2).grantAccess(id, doctor2.address, "X", 7 * DAY, MUST_FAIL), true);
await send("10. [Ràng buộc] Sửa hồ sơ đã ký", "BacSi-1", "updateRecord",
  mr.connect(doctor1).updateRecord(id, files("sua-trai-phep"), "X", "X", MUST_FAIL), true);

// 5. Truy cập khẩn cấp (mở rộng)
await send("11. Mở truy cập khẩn cấp", "BacSi-2", "emergencyAccess",
  mr.connect(doctor2).emergencyAccess(id, "Benh nhan bat tinh (demo)"));
await send("12. Bệnh viện giao khóa khẩn cấp", "Admin-BenhVien", "deliverEmergencyKey",
  mr.connect(admin).deliverEmergencyKey(id, doctor2.address, "DEMO-EMERGENCY-KEY"));
await send("13. Xem hồ sơ (khẩn cấp)", "BacSi-2", "accessRecord", mr.connect(doctor2).accessRecord(id));

// 6. Chứng nhận SBT
const latest = await ethers.provider.getBlock("latest");
const minted = await send("14. Cấp chứng nhận SBT", "Admin-BenhVien", "mint",
  sbt.connect(admin).mint(patient.address, "HEALTH_CHECK_OK", BigInt(latest!.timestamp + 365 * DAY), "ipfs://demo-cert"));
const tokenId = findEvent(sbt, minted, "CertificateIssued").args.tokenId;
console.log(`   -> Token SBT số ${tokenId}`);
console.log(`   -> Bảo hiểm xác thực HEALTH_CHECK_OK = ${await sbt.connect(insurer).hasValidCertificate(patient.address, "HEALTH_CHECK_OK")}`);
await send("15. [Ràng buộc] Chuyển nhượng SBT", "BenhNhan", "transferFrom",
  sbt.connect(patient).transferFrom(patient.address, insurer.address, tokenId, MUST_FAIL), true);

// 7. Ghi bảng kết quả + gas ra file cho báo cáo
const table = [
  "# Kết quả kịch bản kiểm thử trên Sepolia",
  "",
  `Thời điểm chạy: ${new Date().toISOString()} · MedicalRecord: ${await mr.getAddress()} · MedicalSBT: ${await sbt.getAddress()}`,
  "",
  "| Bước | Ví gọi | Hàm | Kết quả | Gas thực tế | Giao dịch |",
  "| --- | --- | --- | --- | ---: | --- |",
  ...rows.map((r) => `| ${r.step} | ${r.caller} | \`${r.fn}\` | ${r.result} | ${r.gasUsed} | [Etherscan](${TX_URL}${r.tx}) |`),
  "",
].join("\n");
writeFileSync("../docs/gas-sepolia.md", table, "utf8");
console.log("\nĐã ghi bảng kết quả vào docs/gas-sepolia.md");