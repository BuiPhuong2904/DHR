"use client";

import { useState } from "react";
import { id } from "ethers";
import type { JsonRpcSigner } from "ethers";
import { connectWallet, dryRun, getContracts } from "@/lib/web3";
import { getAccessLog, getCertificates, hasValidCertificate } from "@/lib/dhr";

const btn =
  "rounded-lg border-2 border-slate-900 bg-slate-900 px-4 py-2 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-40";

export default function Web3TestPage() {
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [patient, setPatient] = useState("0x1E3d9eA7c2a1e9eA970e3a0691147Ec7990A5CE5");
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((prev) => [...prev, line]);
  const run = (fn: () => Promise<void>) => () => {
    fn().catch((e) => add(`❌ ${e instanceof Error ? e.message : String(e)}`));
  };

  async function connect() {
    const { signer, address } = await connectWallet();
    setSigner(signer);
    const net = await signer.provider.getNetwork();
    add(`1. Đã kết nối ví ${address} - mạng chainId ${net.chainId} (Sepolia = 11155111)`);
  }

  async function readState() {
    if (!signer) return;
    const me = await signer.getAddress();
    const { record } = getContracts(signer);
    add(`2. Tổng số hồ sơ trên chuỗi: ${await record.recordCount()}`);
    add(`   Ví hiện tại là bệnh viện? ${await record.hasRole(id("HOSPITAL_ROLE"), me)}`);
    add(`   Ví hiện tại là bác sĩ?    ${await record.hasRole(id("DOCTOR_ROLE"), me)}`);
    add(`   Bệnh nhân đã đăng ký public key? ${((await record.publicKeys(patient)) as string).length > 0}`);
    add(`   Bảo hiểm kiểm tra HEALTH_CHECK_OK: ${await hasValidCertificate(signer, patient, "HEALTH_CHECK_OK")}`);
    const certs = await getCertificates(signer, patient);
    add(`   Chứng nhận SBT của bệnh nhân: ${certs.map((c) => `#${c.tokenId} ${c.certType}`).join(", ") || "(chưa có)"}`);
    const accessLog = await getAccessLog(signer, patient);
    add(`   Nhật ký truy cập (${accessLog.length} lượt):`);
    for (const a of accessLog) {
      add(`     - Hồ sơ ${a.recordId} | ${a.accessor} | ${a.time.toLocaleString("vi-VN")}${a.emergency ? " | KHẨN CẤP" : ""}`);
    }
  }

  async function tryConstraints() {
    if (!signer) return;
    const me = await signer.getAddress();
    const { record, sbt } = getContracts(signer);
    add("3. Chạy thử (staticCall) - không gửi giao dịch, không tốn phí:");
    add(`   grantAccess(hồ sơ 1) bằng ví hiện tại → ${await dryRun(record, "grantAccess", [1n, me, "X", 7n * 86400n])}`);
    add(`   updateRecord(hồ sơ 1 đã ký) → ${await dryRun(record, "updateRecord", [1n, { imageCid: "a", imageHash: id("a"), pdfCid: "b", pdfHash: id("b"), metadataCid: "c", metadataHash: id("c") }, "X", "X"])}`);
    add(`   transferFrom(SBT #1) → ${await dryRun(sbt, "transferFrom", [patient, me, 1n])}`);
  }

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <h1 className="text-3xl font-bold">Kiểm thử lớp kết nối Web3 (Sepolia)</h1>
      <p className="mt-2 text-lg">Đọc dữ liệu và chạy thử giao dịch trên contract thật - trang này không gửi giao dịch nào.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className={btn} onClick={run(connect)}>① Kết nối MetaMask</button>
        <label htmlFor="patient" className="text-lg font-semibold">Ví bệnh nhân:</label>
        <input
          id="patient"
          value={patient}
          onChange={(e) => setPatient(e.target.value)}
          className="w-120 rounded-lg border-2 border-slate-900 px-3 py-2 font-mono text-base"
        />
        <button className={btn} disabled={!signer} onClick={run(readState)}>② Đọc dữ liệu on-chain</button>
        <button className={btn} disabled={!signer} onClick={run(tryConstraints)}>③ Chạy thử vi phạm ràng buộc</button>
      </div>

      <pre className="mt-6 whitespace-pre-wrap rounded-lg border-2 border-slate-900 bg-slate-50 p-4 text-base leading-relaxed">
        {log.length ? log.join("\n") : "Nhật ký sẽ hiện ở đây..."}
      </pre>
      <button onClick={() => setLog([])} className="mt-3 text-lg underline">Xóa nhật ký</button>
    </main>
  );
}