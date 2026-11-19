"use client";

import {
  BrowserProvider,
  Contract,
  type ContractRunner,
  type Eip1193Provider,
  type JsonRpcSigner,
  type TransactionReceipt,
} from "ethers";
import MedicalRecordArtifact from "@/abi/MedicalRecord.json";
import MedicalSBTArtifact from "@/abi/MedicalSBT.json";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
export const DEPLOY_BLOCK = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? 0);
const RECORD_ADDRESS = process.env.NEXT_PUBLIC_MEDICAL_RECORD_ADDRESS ?? "";
const SBT_ADDRESS = process.env.NEXT_PUBLIC_MEDICAL_SBT_ADDRESS ?? "";

/* ======================= Ví & mạng ======================= */

export function getProvider(): BrowserProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Chưa cài MetaMask. Hãy cài tiện ích MetaMask rồi tải lại trang.");
  }
  return new BrowserProvider(window.ethereum);
}

/** Kết nối MetaMask, tự chuyển sang Sepolia nếu đang ở mạng khác. */
export async function connectWallet(): Promise<{ signer: JsonRpcSigner; address: string }> {
  let provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  const net = await provider.getNetwork();
  if (net.chainId !== SEPOLIA_CHAIN_ID) {
    await provider.send("wallet_switchEthereumChain", [{ chainId: SEPOLIA_CHAIN_HEX }]);
    provider = getProvider(); // tạo lại provider sau khi đổi mạng
  }
  const signer = await provider.getSigner();
  return { signer, address: await signer.getAddress() };
}

export function getContracts(runner: ContractRunner) {
  if (!RECORD_ADDRESS || !SBT_ADDRESS) {
    throw new Error("Thiếu NEXT_PUBLIC_MEDICAL_RECORD_ADDRESS / NEXT_PUBLIC_MEDICAL_SBT_ADDRESS trong .env.local");
  }
  return {
    record: new Contract(RECORD_ADDRESS, MedicalRecordArtifact.abi, runner),
    sbt: new Contract(SBT_ADDRESS, MedicalSBTArtifact.abi, runner),
  };
}

/* ======================= Thông báo lỗi tiếng Việt ======================= */

const ERROR_MESSAGES: Record<string, string> = {
  NotPatient: "Chỉ bệnh nhân chủ hồ sơ mới được cấp hoặc thu hồi quyền.",
  NotRecordDoctor: "Chỉ bác sĩ đã tạo hồ sơ mới được sửa hoặc ký hồ sơ này.",
  RecordAlreadySigned: "Hồ sơ đã được ký xác nhận nên không thể chỉnh sửa (tính bất biến).",
  RecordNotFound: "Không tìm thấy hồ sơ.",
  PublicKeyMissing: "Ví này chưa đăng ký khóa công khai RSA.",
  NotDoctor: "Ví được cấp quyền phải là bác sĩ đã được bệnh viện xác nhận.",
  InvalidDuration: "Thời hạn truy cập phải từ 1 giờ đến 30 ngày.",
  EmptyValue: "Thiếu dữ liệu bắt buộc.",
  AccessDenied: "Bạn không có quyền xem hồ sơ này, hoặc quyền đã hết hạn / bị thu hồi.",
  NoActiveEmergency: "Bác sĩ này không có yêu cầu truy cập khẩn cấp còn hiệu lực.",
  InvalidPreviousRecord: "Hồ sơ trước không hợp lệ.",
  InvalidFileKind: "Loại file không hợp lệ.",
  InvalidGuardians: "Danh sách người giám hộ hoặc ngưỡng không hợp lệ.",
  NotGuardian: "Ví này không phải người giám hộ của bệnh nhân.",
  AlreadyVoted: "Bạn đã phê duyệt yêu cầu khôi phục này rồi.",
  InvalidAddress: "Địa chỉ ví không hợp lệ.",
  AccessControlUnauthorizedAccount: "Ví của bạn không có vai trò phù hợp để thực hiện thao tác này.",
  Soulbound: "Chứng nhận sức khỏe là Soulbound Token, không thể chuyển nhượng.",
  InvalidExpiry: "Ngày hết hạn chứng nhận không hợp lệ.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function friendlyError(e: any): string {
  if (e?.code === "ACTION_REJECTED") return "Bạn đã từ chối giao dịch trong MetaMask.";
  if (e?.code === "INSUFFICIENT_FUNDS") return "Ví không đủ SepoliaETH để trả phí giao dịch.";
  const name: string | undefined = e?.revert?.name;
  if (name && ERROR_MESSAGES[name]) return ERROR_MESSAGES[name];
  return e?.shortMessage ?? e?.message ?? "Đã có lỗi xảy ra.";
}

/* ======================= Gửi giao dịch an toàn ======================= */

export type TxStatus = "checking" | "waiting-wallet" | "pending" | "confirmed";

export async function sendTx(
  contract: Contract,
  method: string,
  args: unknown[],
  onStatus?: (status: TxStatus, hash?: string) => void,
): Promise<TransactionReceipt> {
  const fn = contract.getFunction(method);
  try {
    onStatus?.("checking");
    await fn.staticCall(...args);
    onStatus?.("waiting-wallet");
    const tx = await fn.send(...args);
    onStatus?.("pending", tx.hash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Giao dịch thất bại.");
    onStatus?.("confirmed", tx.hash);
    return receipt;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

/** Chỉ chạy thử (không gửi): dùng để minh họa ràng buộc trong demo mà không tạo giao dịch lỗi. */
export async function dryRun(contract: Contract, method: string, args: unknown[]): Promise<string> {
  try {
    await contract.getFunction(method).staticCall(...args);
    return "Hợp lệ - giao dịch sẽ thành công.";
  } catch (e) {
    return friendlyError(e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findEvent(contract: Contract, receipt: TransactionReceipt, name: string): any {
  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === name) return parsed;
  }
  throw new Error(`Không thấy event ${name} trong giao dịch`);
}