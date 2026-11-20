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
  getPatientRecords,
  retrieveRecordFlow,
  getPendingRequests,
  grantAccessFlow,
  getActiveGrants,
  revokeAccessFlow,
  getAccessLog,
  getEmergencyAlerts,
  getCertificates,
  getGuardiansOf,
  setGuardiansFlow,
  type RetrievedRecord,
} from "@/lib/dhr";
import {
  displayName,
  displayOrg,
  CERT_LABELS,
  durationToDays,
  shortAddress,
} from "@/lib/directory";
import { EXPLORER_TX } from "@/lib/web3";

type PatientTab = "records" | "requests" | "authorized" | "logs";

type RecordRow = {
  id: bigint;
  doctor: string;
  signed: boolean;
  createdAt: Date;
  previousRecordId: bigint;
};

type PendingRow = {
  recordId: bigint;
  doctor: string;
  txHash: string;
};

type GrantRow = {
  recordId: bigint;
  doctor: string;
  expiresAt: Date;
  emergency: boolean;
  hasKey: boolean;
};

type AccessLogRow = {
  recordId: bigint;
  accessor: string;
  time: Date;
  emergency: boolean;
  txHash: string;
  reason?: string;
};

type EmergencyAlertRow = {
  recordId: bigint;
  doctor: string;
  reason: string;
  expiresAt: Date;
  txHash: string;
};

type CertRow = {
  tokenId: bigint;
  certType: string;
  issuedAt: Date;
  expiresAt: Date | null;
};

export default function PatientPage() {
  const { address, signer } = useWallet();
  const { privateKey } = useKeys();

  const [activeTab, setActiveTab] = useState<PatientTab>("records");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Thông báo trạng thái, lỗi & link Etherscan
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Dữ liệu thật từ Sepolia
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [viewedRecord, setViewedRecord] = useState<RetrievedRecord | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRow[]>([]);
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [activeGrants, setActiveGrants] = useState<GrantRow[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogRow[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyAlertRow[]>([]);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [guardians, setGuardians] = useState<string[]>([]);
  const [newGuardian, setNewGuardian] = useState("");
  const [threshold, setThreshold] = useState(2);

  const resetFeedback = () => {
    setStepMsg(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setTxHash(null);
  };

  const loadAllData = useCallback(async () => {
    if (!signer || !address) return;
    setLoading(true);
    try {
      const [recList, reqList, logs, alerts, certList, guardianInfo] = await Promise.all([
        getPatientRecords(signer, address),
        getPendingRequests(signer, address),
        getAccessLog(signer, address),
        getEmergencyAlerts(signer, address),
        getCertificates(signer, address),
        getGuardiansOf(signer, address),
      ]);

      setRecords(recList);
      setPendingRequests(reqList);

      // Lấy danh sách bác sĩ đang có quyền trên từng hồ sơ
      const grantsByRecord = await Promise.all(
        recList.map(async (r) => {
          const list = await getActiveGrants(signer, r.id);
          return list.map((g) => ({ ...g, recordId: r.id }));
        })
      );
      setActiveGrants(grantsByRecord.flat());

      // Ghép lý do khẩn cấp theo recordId + doctor
      const mergedLogs: AccessLogRow[] = logs.map((l) => {
        const matchedAlert = alerts.find(
          (a) =>
            a.recordId === l.recordId &&
            a.doctor.toLowerCase() === l.accessor.toLowerCase()
        );
        return { ...l, reason: matchedAlert?.reason };
      });
      setAccessLogs(mergedLogs);

      // Lọc cảnh báo khẩn cấp còn hạn để hiện banner đỏ
      const now = new Date();
      setActiveEmergencies(alerts.filter((a) => a.expiresAt > now));

      setCerts(certList);
      setGuardians(guardianInfo.guardians);
      if (guardianInfo.threshold > 0) setThreshold(guardianInfo.threshold);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [signer, address]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAllData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAllData]);

  // Xem & kiểm tra toàn vẹn hồ sơ
  const handleInspectRecord = async (recordId: bigint) => {
    if (!signer) return;
    if (!privateKey) {
      setErrorMsg("Vui lòng tạo hoặc nạp khóa bí mật RSA ở khung trên trước khi giải mã bệnh án.");
      return;
    }
    resetFeedback();
    setBusy(true);
    try {
      const data = await retrieveRecordFlow({
        signer,
        recordId,
        myPrivateKey: privateKey,
        onStep: (msg) => setStepMsg(msg),
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status === "pending") setStepMsg("Đang chờ xác nhận giao dịch trên Sepolia...");
        },
      });
      setStepMsg(null);
      setViewedRecord(data);
      setSuccessMsg(`Đã giải mã và xác thực toàn vẹn Hồ sơ #${recordId.toString()}!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Duyệt yêu cầu cấp quyền
  const handleApprove = async (req: PendingRow) => {
    if (!signer || !privateKey) {
      setErrorMsg("Thiếu khóa bí mật RSA trong phiên làm việc để bọc khóa giải mã cho bác sĩ.");
      return;
    }
    const key = `${req.recordId.toString()}-${req.doctor}`;
    const label = durations[key] || "7 ngày";
    resetFeedback();
    setBusy(true);
    try {
      await grantAccessFlow({
        signer,
        recordId: req.recordId,
        doctor: req.doctor,
        durationDays: durationToDays(label),
        myPrivateKey: privateKey,
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status === "pending") setStepMsg("Đang gửi giao dịch cấp quyền lên Sepolia...");
        },
      });
      setStepMsg(null);
      setSuccessMsg(`Đã cấp quyền xem Hồ sơ #${req.recordId.toString()} cho ${displayName(req.doctor)} (${label})!`);
      await loadAllData();
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Từ chối (ẩn khỏi danh sách)
  const handleReject = (req: PendingRow) => {
    setPendingRequests((prev) =>
      prev.filter((item) => !(item.recordId === req.recordId && item.doctor === req.doctor))
    );
    setSuccessMsg("Đã ẩn yêu cầu truy cập khỏi danh sách chờ.");
  };

  // Thu hồi quyền bác sĩ
  const handleRevoke = async (grant: GrantRow) => {
    if (!signer) return;
    resetFeedback();
    setBusy(true);
    try {
      await revokeAccessFlow(signer, grant.recordId, grant.doctor, (status, hash) => {
        if (hash) setTxHash(hash);
        if (status === "pending") setStepMsg("Đang gửi giao dịch thu hồi quyền lên Sepolia...");
      });
      setStepMsg(null);
      setSuccessMsg(`Đã thu hồi quyền xem Hồ sơ #${grant.recordId.toString()} của ${displayName(grant.doctor)}!`);
      await loadAllData();
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Lưu danh sách người giám hộ
  const handleSaveGuardians = async () => {
    if (!signer) return;
    resetFeedback();
    setBusy(true);
    try {
      await setGuardiansFlow(signer, guardians, threshold, (status, hash) => {
        if (hash) setTxHash(hash);
        if (status === "pending") setStepMsg("Đang lưu danh sách người giám hộ lên Sepolia...");
      });
      setStepMsg(null);
      setSuccessMsg(`Đã cập nhật ${guardians.length} người giám hộ (ngưỡng ${threshold} phiếu)!`);
      await loadAllData();
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const TABS: { id: PatientTab; label: string; count?: number }[] = [
    { id: "records", label: "1. Hồ sơ của tôi", count: records.length },
    { id: "requests", label: "2. Yêu cầu chờ duyệt", count: pendingRequests.length },
    { id: "authorized", label: "3. Bác sĩ có quyền", count: activeGrants.length },
    { id: "logs", label: "4. Nhật ký & Chứng nhận & Giám hộ" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bệnh nhân */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="success">CHỦ SỞ HỮU HỒ SƠ</Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 mt-2">
              Bảng điều khiển Bệnh nhân
            </h1>
          </div>
          <Button type="button" variant="secondary" onClick={() => void loadAllData()} disabled={!signer || loading}>
            {loading ? "Đang đồng bộ..." : "Làm mới dữ liệu"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                resetFeedback();
                setActiveTab(t.id);
              }}
              className={`px-4 py-2.5 rounded-xl text-base font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === t.id
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-stone-100 text-stone-800 hover:bg-stone-200"
              }`}
            >
              <span>{t.label}</span>
              {typeof t.count === "number" && (
                <span
                  className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                    activeTab === t.id ? "bg-white text-teal-800" : "bg-stone-300 text-stone-900"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Banner cảnh báo đỏ nếu có truy cập khẩn cấp còn hạn */}
      {activeEmergencies.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-500 text-red-950 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-extrabold text-red-800">
            <span>🚨 CẢNH BÁO TRUY CẬP KHẨN CẤP ĐANG HIỆU LỰC</span>
          </div>
          {activeEmergencies.map((em, idx) => (
            <p key={idx} className="text-base">
              • Hồ sơ <strong>#{em.recordId.toString()}</strong> đang được mở khẩn cấp bởi{" "}
              <strong>{displayName(em.doctor)}</strong> ({shortAddress(em.doctor)}) đến{" "}
              <strong>{em.expiresAt.toLocaleString("vi-VN")}</strong> — Lý do: <em>{em.reason}</em>
            </p>
          ))}
        </div>
      )}

      {/* Khung quản lý khóa RSA dùng chung */}
      <KeyPanel />

      {/* Thông báo tiến trình / thành công / lỗi */}
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

      {/* TAB 1: DANH SÁCH HỒ SƠ & XEM / KIỂM TRA TOÀN VẸN */}
      {activeTab === "records" && (
        <div className="space-y-6">
          <Card
            title="Danh sách Hồ sơ Bệnh án của Tôi"
            subtitle="Giải mã dữ liệu từ IPFS và đối chiếu toàn vẹn mã băm với chuỗi khối"
          >
            {!address ? (
              <p className="text-base text-stone-700 py-4">Vui lòng kết nối ví MetaMask để tải hồ sơ của bạn.</p>
            ) : records.length === 0 ? (
              <p className="text-base text-stone-700 py-4">Bạn chưa có hồ sơ bệnh án nào trên hệ thống.</p>
            ) : (
              <Table headers={["Mã hồ sơ", "Bác sĩ khởi tạo", "Ngày tạo", "Trạng thái ký", "Xem & Kiểm tra toàn vẹn"]}>
                {records.map((rec) => (
                  <tr key={rec.id.toString()}>
                    <td className="py-4 px-4 font-bold">#{rec.id.toString()}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold">{displayName(rec.doctor)}</div>
                      {displayOrg(rec.doctor) && (
                        <div className="text-sm text-stone-600">{displayOrg(rec.doctor)}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">{rec.createdAt.toLocaleString("vi-VN")}</td>
                    <td className="py-4 px-4">
                      {rec.signed ? <Badge variant="success">Đã ký</Badge> : <Badge variant="warning">Chưa ký</Badge>}
                    </td>
                    <td className="py-4 px-4">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={!privateKey || busy}
                        onClick={() => void handleInspectRecord(rec.id)}
                      >
                        Giải mã & Kiểm tra toàn vẹn
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          {/* Chi tiết hồ sơ bệnh nhân tự xem + 3 badge toàn vẹn */}
          {viewedRecord && (
            <Card
              title={`Nội dung Bệnh án #${viewedRecord.recordId.toString()}`}
              subtitle={`Bác sĩ tạo: ${displayName(viewedRecord.doctor)} • ${viewedRecord.createdAt.toLocaleString("vi-VN")}`}
              action={
                <div className="flex flex-wrap gap-2">
                  <Badge variant={viewedRecord.integrity.image ? "success" : "danger"}>
                    {viewedRecord.integrity.image ? "✓ Ảnh toàn vẹn" : "✕ Ảnh sai lệch"}
                  </Badge>
                  <Badge variant={viewedRecord.integrity.pdf ? "success" : "danger"}>
                    {viewedRecord.integrity.pdf ? "✓ PDF toàn vẹn" : "✕ PDF sai lệch"}
                  </Badge>
                  <Badge variant={viewedRecord.integrity.metadata ? "success" : "danger"}>
                    {viewedRecord.integrity.metadata ? "✓ Chỉ số toàn vẹn" : "✕ Chỉ số sai lệch"}
                  </Badge>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-2">
                  <h3 className="text-lg font-bold text-stone-950">1. Hình ảnh Y tế</h3>
                  <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-950 aspect-square flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={viewedRecord.imageUrl} alt="Hình ảnh y tế" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div className="lg:col-span-4 space-y-2">
                  <h3 className="text-lg font-bold text-stone-950">2. Tóm tắt Bệnh án (PDF)</h3>
                  <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-100 aspect-square">
                    <iframe src={viewedRecord.pdfUrl} title="Tóm tắt bệnh án PDF" className="w-full h-full" />
                  </div>
                </div>
                <div className="lg:col-span-4 space-y-2">
                  <h3 className="text-lg font-bold text-stone-950">3. Chỉ số Nhân trắc (JSON)</h3>
                  <pre className="bg-stone-950 text-emerald-300 p-4 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed max-h-96">
                    {JSON.stringify(viewedRecord.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: YÊU CẦU CHỜ DUYỆT */}
      {activeTab === "requests" && (
        <Card
          title="Yêu cầu Truy cập Hồ sơ Chờ duyệt"
          subtitle="Chọn thời hạn hiệu lực từ 1 giờ đến 30 ngày trước khi phê duyệt cấp khóa giải mã cho bác sĩ"
        >
          {pendingRequests.length === 0 ? (
            <p className="text-base text-stone-700 py-4">Hiện không có yêu cầu nào đang chờ duyệt.</p>
          ) : (
            <Table headers={["Hồ sơ", "Bác sĩ yêu cầu", "Giao dịch yêu cầu", "Thời hạn cấp quyền", "Hành động"]}>
              {pendingRequests.map((req) => {
                const key = `${req.recordId.toString()}-${req.doctor}`;
                return (
                  <tr key={key}>
                    <td className="py-4 px-4 font-bold">#{req.recordId.toString()}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold">{displayName(req.doctor)}</div>
                      <div className="text-sm font-mono text-stone-500">{shortAddress(req.doctor)}</div>
                    </td>
                    <td className="py-4 px-4">
                      <a
                        href={`${EXPLORER_TX}${req.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm text-teal-700 underline"
                      >
                        {shortAddress(req.txHash)} ↗
                      </a>
                    </td>
                    <td className="py-4 px-4">
                      <select
                        aria-label="Chọn thời hạn"
                        value={durations[key] || "7 ngày"}
                        onChange={(e) => setDurations({ ...durations, [key]: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-base font-semibold focus:border-teal-600 focus:outline-none"
                      >
                        <option value="1 giờ">1 giờ</option>
                        <option value="24 giờ">24 giờ</option>
                        <option value="7 ngày">7 ngày</option>
                        <option value="30 ngày">30 ngày</option>
                      </select>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="success"
                          disabled={!privateKey || busy}
                          onClick={() => void handleApprove(req)}
                        >
                          Duyệt
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busy}
                          onClick={() => handleReject(req)}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 3: BÁC SĨ ĐANG CÓ QUYỀN */}
      {activeTab === "authorized" && (
        <Card
          title="Danh sách Bác sĩ Đang có Quyền Xem Hồ sơ"
          subtitle="Bạn có thể thu hồi quyền truy cập bất cứ lúc nào ngay cả khi chưa hết thời hạn"
        >
          {activeGrants.length === 0 ? (
            <p className="text-base text-stone-700 py-4">Hiện chưa có bác sĩ nào đang giữ quyền xem hồ sơ của bạn.</p>
          ) : (
            <Table headers={["Hồ sơ", "Bác sĩ được cấp quyền", "Hết hạn lúc", "Phân loại", "Thu hồi quyền"]}>
              {activeGrants.map((doc, idx) => (
                <tr key={`${doc.recordId.toString()}-${doc.doctor}-${idx}`}>
                  <td className="py-4 px-4 font-bold">#{doc.recordId.toString()}</td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="font-bold">{displayName(doc.doctor)}</div>
                    <div className="text-sm font-mono text-stone-500">{shortAddress(doc.doctor)}</div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">{doc.expiresAt.toLocaleString("vi-VN")}</td>
                  <td className="py-4 px-4">
                    {doc.emergency ? (
                      <Badge variant="danger">Khẩn cấp</Badge>
                    ) : (
                      <Badge variant="info">Cấp quyền chuẩn</Badge>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void handleRevoke(doc)}
                    >
                      Thu hồi quyền
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 4: NHẬT KÝ TRUY CẬP + CHỨNG NHẬN SBT + NGƯỜI GIÁM HỘ */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          <Card
            title="Nhật ký Truy cập Hồ sơ Bất biến"
            subtitle="Các lượt truy cập khẩn cấp được cảnh báo tô đỏ nổi bật kèm lý do y khoa"
          >
            {accessLogs.length === 0 ? (
              <p className="text-base text-stone-700 py-4">Chưa ghi nhận lượt truy cập nào.</p>
            ) : (
              <Table headers={["Thời gian", "Hồ sơ", "Người truy cập", "Phân loại", "Ghi chú / Lý do khẩn cấp"]}>
                {accessLogs.map((log, idx) => (
                  <tr
                    key={`${log.txHash}-${idx}`}
                    className={log.emergency ? "bg-red-100/90 text-red-950 font-semibold" : ""}
                  >
                    <td className="py-4 px-4 whitespace-nowrap">{log.time.toLocaleString("vi-VN")}</td>
                    <td className="py-4 px-4 font-bold">#{log.recordId.toString()}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold">{displayName(log.accessor)}</div>
                      <div className="text-sm font-mono opacity-80">{shortAddress(log.accessor)}</div>
                    </td>
                    <td className="py-4 px-4">
                      {log.emergency ? (
                        <Badge variant="danger">KHẨN CẤP</Badge>
                      ) : (
                        <Badge variant="neutral">Thông thường</Badge>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {log.reason || "Truy cập hợp lệ theo phân quyền"}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chứng nhận SBT */}
            <Card
              title="Chứng nhận Y tế Định danh Soulbound"
              subtitle="Chứng nhận điện tử gắn vĩnh viễn với ví bệnh nhân, không thể chuyển nhượng"
            >
              {certs.length === 0 ? (
                <p className="text-base text-stone-700 py-4">Bạn chưa được cấp chứng nhận sức khỏe điện tử nào.</p>
              ) : (
                <div className="space-y-3">
                  {certs.map((sbt) => (
                    <div
                      key={sbt.tokenId.toString()}
                      className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-sm font-mono font-bold text-teal-800">
                          Mã chứng nhận #{sbt.tokenId.toString()} • {sbt.certType}
                        </span>
                        <h3 className="text-lg font-bold text-stone-950">
                          {CERT_LABELS[sbt.certType] || sbt.certType}
                        </h3>
                        <p className="text-sm text-stone-700">
                          Ngày cấp: {sbt.issuedAt.toLocaleDateString("vi-VN")} • Hết hạn:{" "}
                          {sbt.expiresAt ? sbt.expiresAt.toLocaleDateString("vi-VN") : "Vô thời hạn"}
                        </p>
                      </div>
                      <Badge variant="success">Hợp lệ</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Người giám hộ khôi phục ví */}
            <Card
              title="Chỉ định Người giám hộ Khôi phục Ví"
              subtitle="Phòng trường hợp mất khóa bí mật: cần đủ số phiếu giám hộ phê duyệt để chuyển hồ sơ sang ví mới"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  {guardians.length === 0 && (
                    <p className="text-sm text-stone-600">Chưa thiết lập ví người giám hộ nào.</p>
                  )}
                  {guardians.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-stone-100 border border-stone-300 font-mono text-sm"
                    >
                      <span className="truncate">{g}</span>
                      <button
                        type="button"
                        onClick={() => setGuardians(guardians.filter((_, i) => i !== idx))}
                        className="text-red-700 font-sans font-bold hover:underline cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGuardian}
                    onChange={(e) => setNewGuardian(e.target.value)}
                    placeholder="Nhập địa chỉ ví người giám hộ 0x..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!newGuardian.trim()) return;
                      setGuardians([...guardians, newGuardian.trim()]);
                      setNewGuardian("");
                    }}
                  >
                    Thêm
                  </Button>
                </div>

                <div className="pt-3 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold text-stone-900 whitespace-nowrap">
                    <span>Ngưỡng duyệt:</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, guardians.length)}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-lg border border-stone-300 text-center font-bold focus:border-teal-600 focus:outline-none"
                    />
                    <span className="text-stone-700 font-semibold">/ {guardians.length} ví</span>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    disabled={!signer || guardians.length === 0 || busy}
                    onClick={() => void handleSaveGuardians()}
                  >
                    {busy ? "Đang lưu..." : "Lưu giám hộ"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}