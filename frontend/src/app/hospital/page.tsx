"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { KeyPanel } from "@/components/KeyPanel";
import { useWallet } from "@/context/WalletContext";
import { useKeys } from "@/context/KeyContext";
import {
  grantDoctorRoleFlow,
  revokeDoctorRoleFlow,
  mintCertificateFlow,
  getOpenEmergencies,
  deliverEmergencyKeyFlow,
} from "@/lib/dhr";
import { displayName, displayOrg, shortAddress } from "@/lib/directory";
import { EXPLORER_TX } from "@/lib/web3";

type OpenEmergencyRow = {
  recordId: bigint;
  doctor: string;
  reason: string;
  expiresAt: Date;
};

export default function HospitalPage() {
  const { address, signer, roles } = useWallet();
  const { privateKey } = useKeys();

  const [busy, setBusy] = useState(false);
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // 1. Cấp / Thu hồi vai trò bác sĩ
  const [doctorWallet, setDoctorWallet] = useState("0xff90d71e01f8c302552a55e4c72f649992f2e5ed");

  // 2. Mint chứng nhận SBT
  const [sbtPatientWallet, setSbtPatientWallet] = useState("0x1E3d9eA7c2a1e9eA970e3a0691147Ec7990A5CE5");
  const [certType, setCertType] = useState("HEALTH_CHECK_OK");
  const [validDays, setValidDays] = useState(365);
  const [certUri, setCertUri] = useState("ipfs://bafybeidhr-health-certificate-v1");

  // 3. Danh sách khẩn cấp chờ giao khóa
  const [emergencies, setEmergencies] = useState<OpenEmergencyRow[]>([]);

  const resetFeedback = () => {
    setStepMsg(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setTxHash(null);
  };

  const loadEmergencies = useCallback(async () => {
    if (!signer) return;
    try {
      const list = await getOpenEmergencies(signer);
      setEmergencies(list);
    } catch {
      /* bỏ qua nếu chưa kết nối mạng */
    }
  }, [signer]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEmergencies();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEmergencies]);

  const handleGrantDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !doctorWallet.trim()) return;
    resetFeedback();
    setBusy(true);
    try {
      await grantDoctorRoleFlow(signer, doctorWallet.trim(), (status, hash) => {
        if (hash) setTxHash(hash);
        if (status === "pending") setStepMsg("Đang cấp vai trò Bác sĩ trên Sepolia...");
      });
      setStepMsg(null);
      setSuccessMsg(`Đã cấp quyền Bác sĩ cho ví ${displayName(doctorWallet.trim())} thành công!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeDoctorRole = async () => {
    if (!signer || !doctorWallet.trim()) return;
    resetFeedback();
    setBusy(true);
    try {
      await revokeDoctorRoleFlow(signer, doctorWallet.trim(), (status, hash) => {
        if (hash) setTxHash(hash);
        if (status === "pending") setStepMsg("Đang thu hồi vai trò Bác sĩ trên Sepolia...");
      });
      setStepMsg(null);
      setSuccessMsg(`Đã thu hồi quyền Bác sĩ của ví ${displayName(doctorWallet.trim())}!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleMintSbt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !sbtPatientWallet.trim()) return;
    resetFeedback();
    setBusy(true);
    try {
      const res = await mintCertificateFlow({
        signer,
        patient: sbtPatientWallet.trim(),
        certType,
        validDays: Number(validDays),
        uri: certUri.trim() || "ipfs://dhr-sbt-metadata",
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status === "pending") setStepMsg("Đang phát hành chứng nhận Soulbound lên Sepolia...");
        },
      });
      setStepMsg(null);
      setSuccessMsg(
        `Đã phát hành Chứng nhận #${res.tokenId.toString()} (${certType}) cho bệnh nhân ${shortAddress(sbtPatientWallet.trim())}!`
      );
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeliverKey = async (item: OpenEmergencyRow) => {
    if (!signer) return;
    if (!privateKey) {
      setErrorMsg("Bệnh viện cần nạp khóa bí mật RSA trong phiên làm việc trước khi giao khóa cấp cứu.");
      return;
    }
    resetFeedback();
    setBusy(true);
    try {
      await deliverEmergencyKeyFlow({
        signer,
        recordId: item.recordId,
        doctor: item.doctor,
        hospitalPrivateKey: privateKey,
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status === "pending") setStepMsg("Đang bọc lại khóa giải mã và gửi cho bác sĩ cấp cứu...");
        },
      });
      setStepMsg(null);
      setSuccessMsg(
        `Đã giao khóa giải mã khẩn cấp Hồ sơ #${item.recordId.toString()} cho ${displayName(item.doctor)}!`
      );
      await loadEmergencies();
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            {roles.isHospital ? (
              <Badge variant="success">Đã xác thực Cơ sở Y tế</Badge>
            ) : (
              <Badge variant="warning">Cần ví Quản trị Bệnh viện</Badge>
            )}
            <span className="text-base font-semibold text-stone-700">
              {address ? `${displayName(address)}${displayOrg(address) ? ` • ${displayOrg(address)}` : ""}` : "Chưa kết nối ví"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 mt-2">
            Cổng Quản trị Cơ sở Y tế
          </h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadEmergencies()} disabled={!signer}>
          Làm mới danh sách cấp cứu
        </Button>
      </div>

      {/* Khung quản lý khóa RSA của Bệnh viện (bắt buộc đăng ký trước khi bác sĩ tạo hồ sơ) */}
      <KeyPanel />

      {stepMsg && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-400 text-teal-950 font-semibold text-base flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-teal-600 animate-ping shrink-0" />
          <span>{stepMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-400 text-red-900 font-semibold text-base">
          ✕ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-500 text-emerald-950 font-semibold text-base flex flex-wrap items-center justify-between gap-2">
          <span>✓ {successMsg}</span>
          {txHash && (
            <a
              href={`${EXPLORER_TX}${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline text-teal-800 font-mono text-sm"
            >
              Xem giao dịch trên Etherscan ↗
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Cấp / Thu hồi vai trò bác sĩ */}
        <Card
          title="1. Cấp & Thu hồi Vai trò Bác sĩ"
          subtitle="Xác thực hoặc gỡ quyền hành nghề của bác sĩ thuộc bệnh viện trên chuỗi khối"
        >
          <form onSubmit={handleGrantDoctor} className="space-y-4">
            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Địa chỉ ví Bác sĩ *</label>
              <input
                type="text"
                required
                value={doctorWallet}
                onChange={(e) => setDoctorWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button type="submit" variant="primary" size="lg" disabled={!signer || busy}>
                Cấp quyền Bác sĩ
              </Button>
              <Button
                type="button"
                variant="danger"
                size="lg"
                disabled={!signer || !doctorWallet.trim() || busy}
                onClick={() => void handleRevokeDoctorRole()}
              >
                Thu hồi quyền Bác sĩ
              </Button>
            </div>
          </form>
        </Card>

        {/* 2. Phát hành chứng nhận SBT */}
        <Card
          title="2. Phát hành Chứng nhận Sức khỏe"
          subtitle="Cấp chứng nhận điện tử không thể chuyển nhượng gắn liền với ví bệnh nhân"
        >
          <form onSubmit={handleMintSbt} className="space-y-4">
            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Địa chỉ ví Bệnh nhân *</label>
              <input
                type="text"
                required
                value={sbtPatientWallet}
                onChange={(e) => setSbtPatientWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Loại chứng nhận *</label>
              <select
                value={certType}
                onChange={(e) => setCertType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-base font-semibold focus:border-teal-600 focus:outline-none"
              >
                <option value="HEALTH_CHECK_OK">Chứng nhận Đủ sức khỏe Lao động / Học tập</option>
                <option value="VACCINATION_HEPB">Chứng nhận Tiêm chủng Viêm gan B</option>
                <option value="TREATMENT_COMPLETED">Chứng nhận Hoàn thành Điều trị</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-900 mb-1.5">Thời hạn hiệu lực (ngày)</label>
                <input
                  type="number"
                  min={0}
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-900 mb-1.5">Đường dẫn dữ liệu (URI)</label>
                <input
                  type="text"
                  value={certUri}
                  onChange={(e) => setCertUri(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <Button type="submit" variant="success" size="lg" disabled={!signer || busy} className="w-full">
              {busy ? "Đang phát hành..." : "Phát hành Chứng nhận SBT"}
            </Button>
          </form>
        </Card>
      </div>

      {/* 3. Danh sách khẩn cấp chờ giao khóa */}
      <Card
        title="3. Điều phối Khóa Giải mã Khẩn cấp"
        subtitle="Danh sách các yêu cầu cấp cứu còn hiệu lực đang chờ bệnh viện cấp khóa giải mã"
      >
        {emergencies.length === 0 ? (
          <p className="text-base text-stone-700 py-4">Hiện không có yêu cầu truy cập khẩn cấp nào đang chờ giao khóa.</p>
        ) : (
          <Table headers={["Hồ sơ", "Bác sĩ yêu cầu cấp cứu", "Lý do khẩn cấp", "Hết hạn lúc", "Thao tác"]}>
            {emergencies.map((item, idx) => (
              <tr key={`${item.recordId.toString()}-${item.doctor}-${idx}`}>
                <td className="py-4 px-4 font-bold">#{item.recordId.toString()}</td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <div className="font-bold">{displayName(item.doctor)}</div>
                  <div className="text-sm font-mono text-stone-600">{shortAddress(item.doctor)}</div>
                </td>
                <td className="py-4 px-4 text-red-900 font-medium">{item.reason}</td>
                <td className="py-4 px-4 whitespace-nowrap">{item.expiresAt.toLocaleString("vi-VN")}</td>
                <td className="py-4 px-4">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!privateKey || busy}
                    onClick={() => void handleDeliverKey(item)}
                  >
                    Giao khóa khẩn cấp
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}