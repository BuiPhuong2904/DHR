"use client";

import { id, type ContractRunner, type JsonRpcSigner } from "ethers";
import {
  decryptData,
  encryptData,
  generateAesKey,
  importPublicKeyPem,
  sha256Hex,
  unwrapAesKey,
  wrapAesKey,
  exportPublicKeyPem,
} from "@/lib/crypto";
import { DEPLOY_BLOCK, findEvent, getContracts, sendTx, type TxStatus } from "@/lib/web3";

type OnStatus = (status: TxStatus, hash?: string) => void;
type OnStep = (message: string) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

const HOSPITAL_ADDRESS = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";
const DAY = 24 * 60 * 60;
const toBytes32 = (hex: string) => `0x${hex}`;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/* ======================= Đọc event theo từng đoạn block ======================= */

const LOG_CHUNK = 9_000;

async function queryLogs(contract: AnyContract, filter: AnyContract): Promise<AnyContract[]> {
  const provider = contract.runner?.provider ?? contract.runner;
  const latest: number = await provider.getBlockNumber();
  const logs: AnyContract[] = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, latest);
    logs.push(...(await contract.queryFilter(filter, from, to)));
  }
  return logs;
}

/* ======================= IPFS ======================= */

async function uploadToIpfs(data: ArrayBuffer, name: string): Promise<string> {
  const form = new FormData();
  // Tên file trung tính, không lộ tên gốc của bệnh nhân
  form.append("file", new Blob([data], { type: "application/octet-stream" }), name);
  const res = await fetch("/api/ipfs/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(`Tải lên IPFS thất bại: ${JSON.stringify(json.error)}`);
  return json.cid as string;
}

async function downloadFromIpfs(cid: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/ipfs/retrieve?cid=${encodeURIComponent(cid)}`);
  if (!res.ok) throw new Error(`Không tải được file ${cid} từ IPFS`);
  return res.arrayBuffer();
}

async function getPublicKey(record: AnyContract, account: string): Promise<CryptoKey> {
  const pem: string = await record.publicKeys(account);
  if (!pem) throw new Error(`Ví ${account} chưa đăng ký khóa công khai RSA.`);
  return importPublicKeyPem(pem);
}

/* ======================= Khóa công khai ======================= */

export async function registerPublicKeyFlow(signer: JsonRpcSigner, publicKey: CryptoKey, onStatus?: OnStatus) {
  const { record } = getContracts(signer);
  return sendTx(record, "registerPublicKey", [await exportPublicKeyPem(publicKey)], onStatus);
}

export async function hasPublicKey(runner: ContractRunner, account: string): Promise<boolean> {
  const { record } = getContracts(runner);
  return ((await record.publicKeys(account)) as string).length > 0;
}

/* ======================= Nghiệp vụ 1: Tạo hồ sơ (bác sĩ) ======================= */

export async function createRecordFlow(p: {
  signer: JsonRpcSigner;
  patient: string;
  image: File;
  pdf: File;
  metadata: object;
  previousRecordId?: bigint;
  onStatus?: OnStatus;
  onStep?: OnStep;
}) {
  const step = p.onStep ?? (() => {});
  const { record } = getContracts(p.signer);
  if (!HOSPITAL_ADDRESS) throw new Error("Thiếu NEXT_PUBLIC_HOSPITAL_ADDRESS trong .env.local");

  step("Đọc khóa công khai của bệnh nhân và bệnh viện...");
  const patientKey = await getPublicKey(record, p.patient);
  const hospitalKey = await getPublicKey(record, HOSPITAL_ADDRESS);

  const aesKey = await generateAesKey();
  const sources: [string, ArrayBuffer][] = [
    ["image", await p.image.arrayBuffer()],
    ["pdf", await p.pdf.arrayBuffer()],
    ["metadata", new TextEncoder().encode(JSON.stringify(p.metadata)).buffer as ArrayBuffer],
  ];

  const cids: string[] = [];
  const hashes: string[] = [];
  for (const [kind, data] of sources) {
    step(`Băm SHA-256, mã hóa AES và tải ${kind} lên IPFS...`);
    hashes.push(toBytes32(await sha256Hex(data)));
    cids.push(await uploadToIpfs(await encryptData(data, aesKey), `dhr-${kind}-${Date.now()}.enc`));
  }

  step("Bọc khóa AES bằng RSA cho bệnh nhân và bệnh viện...");
  const patientWrapped = await wrapAesKey(aesKey, patientKey);
  const escrowWrapped = await wrapAesKey(aesKey, hospitalKey);
  const files = {
    imageCid: cids[0],
    imageHash: hashes[0],
    pdfCid: cids[1],
    pdfHash: hashes[1],
    metadataCid: cids[2],
    metadataHash: hashes[2],
  };

  step("Gửi giao dịch createRecord...");
  const receipt = await sendTx(
    record,
    "createRecord",
    [p.patient, files, patientWrapped, escrowWrapped, p.previousRecordId ?? 0n],
    p.onStatus,
  );
  const recordId = findEvent(record, receipt, "RecordCreated").args.id as bigint;
  return { recordId, receipt, cids };
}

export async function signRecordFlow(signer: JsonRpcSigner, recordId: bigint, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "signRecord", [recordId], onStatus);
}

export async function requestAccessFlow(signer: JsonRpcSigner, recordId: bigint, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "requestAccess", [recordId], onStatus);
}

/* ======================= Nghiệp vụ 2: Cấp / thu hồi quyền (bệnh nhân) ======================= */

export async function grantAccessFlow(p: {
  signer: JsonRpcSigner;
  recordId: bigint;
  doctor: string;
  durationDays: number;
  myPrivateKey: CryptoKey;
  onStatus?: OnStatus;
}) {
  const { record } = getContracts(p.signer);
  const r = await record.getRecord(p.recordId);
  const aesKey = await unwrapAesKey(r.patientWrappedKey, p.myPrivateKey); // mở bằng khóa bệnh nhân
  const wrapped = await wrapAesKey(aesKey, await getPublicKey(record, p.doctor)); // bọc lại cho bác sĩ
  return sendTx(record, "grantAccess", [p.recordId, p.doctor, wrapped, BigInt(Math.round(p.durationDays * DAY))], p.onStatus);
}

export async function revokeAccessFlow(signer: JsonRpcSigner, recordId: bigint, doctor: string, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "revokeAccess", [recordId, doctor], onStatus);
}

/* ======================= Xem hồ sơ (retrieve) + Nghiệp vụ 3: kiểm tra toàn vẹn ======================= */

export type RetrievedRecord = {
  recordId: bigint;
  doctor: string;
  signed: boolean;
  createdAt: Date;
  imageUrl: string;
  pdfUrl: string;
  metadata: unknown;
  integrity: { image: boolean; pdf: boolean; metadata: boolean };
};

export async function retrieveRecordFlow(p: {
  signer: JsonRpcSigner;
  recordId: bigint;
  myPrivateKey: CryptoKey;
  onStatus?: OnStatus;
  onStep?: OnStep;
}): Promise<RetrievedRecord> {
  const step = p.onStep ?? (() => {});
  const { record } = getContracts(p.signer);
  const me = await p.signer.getAddress();

  step("Ghi nhật ký truy cập lên blockchain (accessRecord)...");
  await sendTx(record, "accessRecord", [p.recordId], p.onStatus);

  const r = await record.getRecord(p.recordId);
  const wrapped: string = same(me, r.patient)
    ? r.patientWrappedKey
    : (await record.getAccess(p.recordId, me)).wrappedKey;
  const aesKey = await unwrapAesKey(wrapped, p.myPrivateKey);

  step("Tải 3 file từ IPFS và giải mã AES...");
  const [image, pdf, meta] = await Promise.all(
    [r.imageCid, r.pdfCid, r.metadataCid].map(async (cid: string) => decryptData(await downloadFromIpfs(cid), aesKey)),
  );

  step("Kiểm tra toàn vẹn: so SHA-256 với mã băm trên blockchain...");
  const matches = async (data: ArrayBuffer, onChain: string) => same(toBytes32(await sha256Hex(data)), onChain);

  return {
    recordId: p.recordId,
    doctor: r.doctor,
    signed: r.signed,
    createdAt: new Date(Number(r.createdAt) * 1000),
    imageUrl: URL.createObjectURL(new Blob([image])),
    pdfUrl: URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
    metadata: JSON.parse(new TextDecoder().decode(meta)),
    integrity: {
      image: await matches(image, r.imageHash),
      pdf: await matches(pdf, r.pdfHash),
      metadata: await matches(meta, r.metadataHash),
    },
  };
}

/** Kiểm tra một file bất kỳ (người dùng tự chọn) có khớp hash trên chuỗi không. kind: 0 ảnh, 1 PDF, 2 JSON */
export async function verifyFileFlow(runner: ContractRunner, recordId: bigint, kind: 0 | 1 | 2, file: File) {
  const { record } = getContracts(runner);
  const hash = toBytes32(await sha256Hex(await file.arrayBuffer()));
  return (await record.verifyFile(recordId, kind, hash)) as boolean;
}

/* ======================= Mở rộng: Truy cập khẩn cấp ======================= */

export async function emergencyAccessFlow(signer: JsonRpcSigner, recordId: bigint, reason: string, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "emergencyAccess", [recordId, reason], onStatus);
}

/** Bệnh viện mở bản escrow bằng private key bệnh viện, bọc lại cho bác sĩ cấp cứu */
export async function deliverEmergencyKeyFlow(p: {
  signer: JsonRpcSigner;
  recordId: bigint;
  doctor: string;
  hospitalPrivateKey: CryptoKey;
  onStatus?: OnStatus;
}) {
  const { record } = getContracts(p.signer);
  const r = await record.getRecord(p.recordId);
  const aesKey = await unwrapAesKey(r.escrowWrappedKey, p.hospitalPrivateKey);
  const wrapped = await wrapAesKey(aesKey, await getPublicKey(record, p.doctor));
  return sendTx(record, "deliverEmergencyKey", [p.recordId, p.doctor, wrapped], p.onStatus);
}

/* ======================= Social recovery ======================= */

export async function setGuardiansFlow(signer: JsonRpcSigner, guardians: string[], threshold: number, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "setGuardians", [guardians, threshold], onStatus);
}

export async function approveRecoveryFlow(signer: JsonRpcSigner, oldWallet: string, newWallet: string, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "approveRecovery", [oldWallet, newWallet], onStatus);
}

/** Sau khôi phục: bệnh viện bọc lại khóa AES cho ví mới (ví mới phải đăng ký public key trước) */
export async function rewrapAfterRecoveryFlow(p: {
  signer: JsonRpcSigner;
  recordId: bigint;
  hospitalPrivateKey: CryptoKey;
  onStatus?: OnStatus;
}) {
  const { record } = getContracts(p.signer);
  const r = await record.getRecord(p.recordId);
  const aesKey = await unwrapAesKey(r.escrowWrappedKey, p.hospitalPrivateKey);
  const wrapped = await wrapAesKey(aesKey, await getPublicKey(record, r.patient));
  return sendTx(record, "rewrapPatientKey", [p.recordId, wrapped], p.onStatus);
}

/* ======================= Đọc dữ liệu cho dashboard ======================= */

export async function getPatientRecords(runner: ContractRunner, patient: string) {
  const { record } = getContracts(runner);
  const ids: bigint[] = [...(await record.getPatientRecords(patient))];
  return Promise.all(
    ids.map(async (id) => {
      const r = await record.getRecord(id);
      return {
        id,
        doctor: r.doctor as string,
        signed: r.signed as boolean,
        createdAt: new Date(Number(r.createdAt) * 1000),
        previousRecordId: r.previousRecordId as bigint,
      };
    }),
  );
}

/** Bác sĩ đang có quyền + thời hạn còn lại */
export async function getActiveGrants(runner: ContractRunner, recordId: bigint) {
  const { record } = getContracts(runner);
  const grantees: string[] = [...(await record.getGrantees(recordId))];
  const now = Math.floor(Date.now() / 1000);
  const rows = await Promise.all(
    grantees.map(async (doctor) => {
      const a = await record.getAccess(recordId, doctor);
      return { doctor, expiresAt: Number(a.expiresAt), emergency: a.emergency as boolean, hasKey: (a.wrappedKey as string).length > 0 };
    }),
  );
  return rows.filter((r) => r.expiresAt > now).map((r) => ({ ...r, expiresAt: new Date(r.expiresAt * 1000) }));
}

/** Nhật ký truy cập toàn bộ hồ sơ của bệnh nhân (đọc event RecordAccessed), mới nhất trước */
export async function getAccessLog(runner: ContractRunner, patient: string) {
  const { record } = getContracts(runner);
  const ids = new Set(([...(await record.getPatientRecords(patient))] as bigint[]).map(String));
  const logs: AnyContract[] = await queryLogs(record, record.filters.RecordAccessed());
  return logs
    .filter((l) => ids.has(String(l.args.id)))
    .map((l) => ({
      recordId: l.args.id as bigint,
      accessor: l.args.accessor as string,
      time: new Date(Number(l.args.timestamp) * 1000),
      emergency: l.args.emergency as boolean,
      txHash: l.transactionHash as string,
    }))
    .reverse();
}

/** Yêu cầu quyền đang chờ (bác sĩ đã yêu cầu nhưng chưa có quyền còn hạn) */
export async function getPendingRequests(runner: ContractRunner, patient: string) {
  const { record } = getContracts(runner);
  const logs: AnyContract[] = await queryLogs(record, record.filters.AccessRequested(null, null, patient));
  const seen = new Set<string>();
  const pending = [];
  for (const l of logs.reverse()) {
    const key = `${l.args.id}-${l.args.doctor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = await record.getRecord(l.args.id);
    if (!same(r.patient, patient)) continue;
    if (!(await record.hasAccess(l.args.id, l.args.doctor))) {
      pending.push({ recordId: l.args.id as bigint, doctor: l.args.doctor as string, txHash: l.transactionHash as string });
    }
  }
  return pending;
}

/** Cảnh báo truy cập khẩn cấp trên hồ sơ của bệnh nhân */
export async function getEmergencyAlerts(runner: ContractRunner, patient: string) {
  const { record } = getContracts(runner);
  const ids = new Set(([...(await record.getPatientRecords(patient))] as bigint[]).map(String));
  const logs: AnyContract[] = await queryLogs(record, record.filters.EmergencyAccessed());
  return logs
    .filter((l) => ids.has(String(l.args.id)))
    .map((l) => ({
      recordId: l.args.id as bigint,
      doctor: l.args.doctor as string,
      reason: l.args.reason as string,
      expiresAt: new Date(Number(l.args.expiresAt) * 1000),
      txHash: l.transactionHash as string,
    }))
    .reverse();
}

/* ======================= Chứng nhận SBT ======================= */

export async function mintCertificateFlow(p: {
  signer: JsonRpcSigner;
  patient: string;
  certType: string;
  validDays: number;
  uri: string;
  onStatus?: OnStatus;
}) {
  const { sbt } = getContracts(p.signer);
  const expiresAt = p.validDays > 0 ? BigInt(Math.floor(Date.now() / 1000) + p.validDays * DAY) : 0n;
  const receipt = await sendTx(sbt, "mint", [p.patient, p.certType, expiresAt, p.uri], p.onStatus);
  return { tokenId: findEvent(sbt, receipt, "CertificateIssued").args.tokenId as bigint, receipt };
}

export async function hasValidCertificate(runner: ContractRunner, patient: string, certType: string) {
  return (await getContracts(runner).sbt.hasValidCertificate(patient, certType)) as boolean;
}

/** Danh sách chứng nhận còn sở hữu của bệnh nhân */
export async function getCertificates(runner: ContractRunner, patient: string) {
  const { sbt } = getContracts(runner);
  const logs: AnyContract[] = await queryLogs(sbt, sbt.filters.CertificateIssued(null, patient));
  const certs = [];
  for (const l of logs) {
    try {
      const c = await sbt.getCertificate(l.args.tokenId); // token đã bị thu hồi sẽ báo lỗi
      certs.push({
        tokenId: l.args.tokenId as bigint,
        certType: c.certType as string,
        issuedAt: new Date(Number(c.issuedAt) * 1000),
        expiresAt: Number(c.expiresAt) === 0 ? null : new Date(Number(c.expiresAt) * 1000),
      });
    } catch {
      /* đã thu hồi */
    }
  }
  return certs;
}

/* ======================= Bệnh viện: quản lý bác sĩ & khẩn cấp ======================= */

export async function grantDoctorRoleFlow(signer: JsonRpcSigner, doctor: string, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "grantRole", [id("DOCTOR_ROLE"), doctor], onStatus);
}

export async function revokeDoctorRoleFlow(signer: JsonRpcSigner, doctor: string, onStatus?: OnStatus) {
  return sendTx(getContracts(signer).record, "revokeRole", [id("DOCTOR_ROLE"), doctor], onStatus);
}

/** Các yêu cầu khẩn cấp còn hạn nhưng CHƯA được bệnh viện giao khóa – hiển thị ở trang /hospital */
export async function getOpenEmergencies(runner: ContractRunner) {
  const { record } = getContracts(runner);
  const logs: AnyContract[] = await queryLogs(record, record.filters.EmergencyAccessed());
  const now = Math.floor(Date.now() / 1000);
  const open = [];
  for (const l of logs.reverse()) {
    const a = await record.getAccess(l.args.id, l.args.doctor);
    if (a.emergency && Number(a.expiresAt) > now && (a.wrappedKey as string).length === 0) {
      open.push({
        recordId: l.args.id as bigint,
        doctor: l.args.doctor as string,
        reason: l.args.reason as string,
        expiresAt: new Date(Number(a.expiresAt) * 1000),
      });
    }
  }
  return open;
}

/** Danh sách người giám hộ hiện tại của bệnh nhân */
export async function getGuardiansOf(runner: ContractRunner, patient: string) {
  const [guardians, threshold] = await getContracts(runner).record.getGuardians(patient);
  return { guardians: [...guardians] as string[], threshold: Number(threshold) };
}