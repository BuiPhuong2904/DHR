"use client";

import { useState } from "react";
import {
  backupPrivateKey,
  bufToHex,
  decryptData,
  encryptData,
  exportPublicKeyPem,
  generateAesKey,
  generateRsaKeyPair,
  restorePrivateKey,
  sha256Hex,
  unwrapAesKey,
  wrapAesKey,
} from "@/lib/crypto";

type EncryptedResult = {
  packed: ArrayBuffer;
  wrappedKey: string;
  originalHash: string;
  fileName: string;
  mimeType: string;
};

const btn =
  "rounded-lg border-2 border-slate-900 bg-slate-900 px-4 py-2 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-40";

export default function CryptoTestPage() {
  const [patientKeys, setPatientKeys] = useState<CryptoKeyPair | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [encrypted, setEncrypted] = useState<EncryptedResult | null>(null);
  const [password, setPassword] = useState("matkhau-dhr-2026");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const add = (line: string) => setLog((prev) => [...prev, line]);
  const errName = (e: unknown) => (e instanceof Error ? e.message || e.name : String(e));
  const run = (fn: () => Promise<void>) => () => {
    fn().catch((e) => add(`❌ Lỗi: ${errName(e)}`));
  };

  // 1. Bệnh nhân tạo cặp khóa RSA
  async function createPatientKeys() {
    const keys = await generateRsaKeyPair();
    setPatientKeys(keys);
    const pem = await exportPublicKeyPem(keys.publicKey);
    add("1. Đã tạo cặp khóa RSA-OAEP 2048 cho bệnh nhân.");
    add(`   Public key (rút gọn): ${pem.split("\n")[1].slice(0, 40)}...`);
  }

  // 2. Mã hóa file bằng AES, bọc khóa AES bằng public key bệnh nhân
  async function encryptFile() {
    if (!patientKeys || !file) return;
    const data = await file.arrayBuffer();
    const originalHash = await sha256Hex(data);
    const aesKey = await generateAesKey();
    const packed = await encryptData(data, aesKey);
    const wrappedKey = await wrapAesKey(aesKey, patientKeys.publicKey);
    setEncrypted({
      packed,
      wrappedKey,
      originalHash,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    add(`2. Đã mã hóa "${file.name}" bằng AES-256-GCM.`);
    add(`   SHA-256 file gốc     : ${originalHash}`);
    add(`   Kích thước           : ${data.byteLength} byte -> ${packed.byteLength} byte (thêm 12 byte IV + 16 byte authTag)`);
    add(`   32 byte đầu file gốc : ${bufToHex(data.slice(0, 32))}`);
    add(`   32 byte đầu bản mã   : ${bufToHex(packed.slice(0, 32))}`);
    add(`   Khóa AES đã bọc RSA  : ${wrappedKey.slice(0, 40)}...`);
  }

  // 3. Bệnh nhân dùng private key mở khóa AES, giải mã và kiểm tra toàn vẹn
  async function decryptAsPatient() {
    if (!patientKeys || !encrypted) return;
    const aesKey = await unwrapAesKey(encrypted.wrappedKey, patientKeys.privateKey);
    const plain = await decryptData(encrypted.packed, aesKey);
    const hash = await sha256Hex(plain);
    add("3. Bệnh nhân mở khóa AES bằng private key và giải mã thành công.");
    add(`   SHA-256 sau giải mã  : ${hash}`);
    add(hash === encrypted.originalHash ? "    Khớp với file gốc - dữ liệu toàn vẹn." : "   KHÔNG khớp với file gốc!");
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(URL.createObjectURL(new Blob([plain], { type: encrypted.mimeType })));
  }

  // 4. Người không được cấp quyền (private key khác) thử mở khóa
  async function decryptAsStranger() {
    if (!encrypted) return;
    const stranger = await generateRsaKeyPair();
    try {
      await unwrapAesKey(encrypted.wrappedKey, stranger.privateKey);
      add("4. Lỗi: người lạ lại mở được khóa!");
    } catch (e) {
      add(`4. Người không được cấp quyền dùng private key khác -> bị từ chối (${errName(e)}).`);
    }
  }

  // 5. Sao lưu private key bằng mật khẩu và khôi phục
  async function backupAndRestore() {
    if (!patientKeys || !encrypted) return;
    const backup = await backupPrivateKey(patientKeys.privateKey, password);
    add(`5. Đã sao lưu private key bằng mật khẩu (PBKDF2 ${backup.iterations.toLocaleString("vi-VN")} vòng + AES-GCM).`);
    add(`   Bản sao lưu (rút gọn): ${backup.data.slice(0, 40)}...`);

    const restored = await restorePrivateKey(backup, password);
    const aesKey = await unwrapAesKey(encrypted.wrappedKey, restored);
    await decryptData(encrypted.packed, aesKey);
    add("   Khôi phục bằng đúng mật khẩu -> vẫn giải mã được hồ sơ.");

    try {
      await restorePrivateKey(backup, password + "-sai");
      add("   Lỗi: mật khẩu sai vẫn khôi phục được!");
    } catch (e) {
      add(`   Nhập sai mật khẩu -> không khôi phục được (${errName(e)}).`);
    }
  }

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <h1 className="text-3xl font-bold">Thử nghiệm mã hóa bao thư (AES-256-GCM + RSA-OAEP)</h1>
      <p className="mt-2 text-lg">
        Trang kiểm thử của nhóm - mọi thao tác chạy trong trình duyệt, không gửi dữ liệu đi đâu.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className={btn} onClick={run(createPatientKeys)}>
          1. Tạo khóa RSA bệnh nhân
        </button>
        <input
          type="file"
          className="text-lg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className={btn} disabled={!patientKeys || !file} onClick={run(encryptFile)}>
          2. Mã hóa file
        </button>
        <button className={btn} disabled={!encrypted} onClick={run(decryptAsPatient)}>
          3. Giải mã (bệnh nhân)
        </button>
        <button className={btn} disabled={!encrypted} onClick={run(decryptAsStranger)}>
          4. Thử giải mã bằng khóa người lạ
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="pw" className="text-lg font-semibold">
          Mật khẩu sao lưu:
        </label>
        <input
          id="pw"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border-2 border-slate-900 px-3 py-2 text-lg"
        />
        <button className={btn} disabled={!encrypted} onClick={run(backupAndRestore)}>
          5. Thử sao lưu / khôi phục khóa
        </button>
        {downloadUrl && encrypted && (
          <a
            href={downloadUrl}
            download={`giai-ma_${encrypted.fileName}`}
            className="text-lg font-semibold underline"
          >
            Tải file đã giải mã
          </a>
        )}
      </div>

      <pre className="mt-6 whitespace-pre-wrap rounded-lg border-2 border-slate-900 bg-slate-50 p-4 text-base leading-relaxed">
        {log.length ? log.join("\n") : "Nhật ký sẽ hiện ở đây..."}
      </pre>
      <button onClick={() => setLog([])} className="mt-3 text-lg underline">
        Xóa nhật ký
      </button>
    </main>
  );
}