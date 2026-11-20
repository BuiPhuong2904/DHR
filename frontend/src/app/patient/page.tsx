"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import {
  INITIAL_RECORDS,
  INITIAL_PENDING_REQUESTS,
  INITIAL_AUTHORIZED_DOCTORS,
  INITIAL_ACCESS_LOGS,
  INITIAL_SBTS,
  AccessRequestItem,
  AuthorizedDoctorItem,
} from "@/mock/dhrData";
import {
  generateRsaKeyPair,
  exportPublicKeyPem,
  backupPrivateKey,
} from "@/lib/crypto";

type PatientTab = "keys" | "records" | "requests" | "authorized" | "logs";

export default function PatientPage() {
  const [activeTab, setActiveTab] = useState<PatientTab>("keys");
  const [toast, setToast] = useState<string | null>(null);

  // 1. State Khóa RSA
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [publicKeyPem, setPublicKeyPem] = useState<string>("");
  const [backupPassword, setBackupPassword] = useState<string>("");
  const [generatingKey, setGeneratingKey] = useState(false);

  // 2. State Kiểm tra toàn vẹn
  const [verifiedMap, setVerifiedMap] = useState<Record<number, boolean>>({});

  // 3. State Yêu cầu chờ duyệt
  const [pendingRequests, setPendingRequests] = useState<AccessRequestItem[]>(INITIAL_PENDING_REQUESTS);
  const [durations, setDurations] = useState<Record<string, string>>({
    "REQ-01": "7 ngày",
    "REQ-02": "24 giờ",
  });

  // 4. State Bác sĩ đang có quyền
  const [authorizedDoctors, setAuthorizedDoctors] = useState<AuthorizedDoctorItem[]>(INITIAL_AUTHORIZED_DOCTORS);

  // 5. State Người giám hộ
  const [guardians, setGuardians] = useState<string[]>([
    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  ]);
  const [newGuardian, setNewGuardian] = useState("");
  const [threshold, setThreshold] = useState(2);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerateRsa = async () => {
    setGeneratingKey(true);
    try {
      const kp = await generateRsaKeyPair();
      const pem = await exportPublicKeyPem(kp.publicKey);
      setKeyPair(kp);
      setPublicKeyPem(pem);
      showToast("Đã tạo cặp khóa bảo mật RSA-2048 trên trình duyệt và sẵn sàng đăng ký lên hệ thống!");
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleDownloadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyPair || !backupPassword) return;
    const backupObj = await backupPrivateKey(keyPair.privateKey, backupPassword);
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dhr-private-key-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã mã hóa khóa bí mật bằng mật khẩu cá nhân và tải xuống tệp sao lưu!");
  };

  const handleVerifyIntegrity = (recordId: number) => {
    setVerifiedMap((prev) => ({ ...prev, [recordId]: true }));
    showToast(`Hồ sơ #${recordId}: Mã băm toàn vẹn của ảnh, PDF và chỉ số khớp 100% với dữ liệu gốc!`);
  };

  const handleApproveRequest = (req: AccessRequestItem) => {
    const selectedDuration = durations[req.requestId] || "7 ngày";
    setPendingRequests((prev) => prev.filter((item) => item.requestId !== req.requestId));
    setAuthorizedDoctors((prev) => [
      {
        recordId: req.recordId,
        doctorAddress: req.doctorAddress,
        doctorName: req.doctorName,
        hospitalName: req.hospitalName,
        expiresAt: "2026-11-26 14:30",
        remainingText: selectedDuration,
        emergency: false,
      },
      ...prev,
    ]);
    showToast(`Đã cấp quyền xem Hồ sơ #${req.recordId} cho ${req.doctorName} trong thời hạn ${selectedDuration}!`);
  };

  const handleRejectRequest = (reqId: string) => {
    setPendingRequests((prev) => prev.filter((item) => item.requestId !== reqId));
    showToast("Đã từ chối yêu cầu truy cập hồ sơ.");
  };

  const handleRevokeDoctor = (doc: AuthorizedDoctorItem) => {
    setAuthorizedDoctors((prev) =>
      prev.filter((d) => !(d.recordId === doc.recordId && d.doctorAddress === doc.doctorAddress))
    );
    showToast(`Đã thu hồi quyền xem Hồ sơ #${doc.recordId} của ${doc.doctorName} ngay lập tức!`);
  };

  const TABS: { id: PatientTab; label: string; count?: number }[] = [
    { id: "keys", label: "1. Khóa RSA & Bảo mật" },
    { id: "records", label: "2. Hồ sơ của tôi", count: INITIAL_RECORDS.length },
    { id: "requests", label: "3. Yêu cầu chờ duyệt", count: pendingRequests.length },
    { id: "authorized", label: "4. Bác sĩ có quyền", count: authorizedDoctors.length },
    { id: "logs", label: "5. Nhật ký & Chứng nhận & Giám hộ" },
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
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
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

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-500 text-emerald-950 font-semibold text-base">
          ✓ {toast}
        </div>
      )}

      {/* TAB 1: TẠO & SAO LƯU KHÓA RSA */}
      {activeTab === "keys" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title="Khởi tạo Cặp khóa Bảo mật RSA-2048"
            subtitle="Khóa công khai được đăng ký lên chuỗi khối để bác sĩ mã hóa bệnh án gửi riêng cho bạn"
          >
            <div className="space-y-4">
              <Button type="button" variant="primary" size="lg" onClick={handleGenerateRsa} disabled={generatingKey}>
                {generatingKey ? "Đang sinh khóa..." : "Tạo cặp khóa RSA mới"}
              </Button>

              <div>
                <label className="block font-bold text-stone-900 mb-1.5">
                  Khóa công khai định dạng PEM
                </label>
                <textarea
                  readOnly
                  rows={7}
                  value={
                    publicKeyPem ||
                    "Chưa có khóa trong phiên làm việc. Bấm 'Tạo cặp khóa RSA mới' để khởi tạo..."
                  }
                  className="w-full p-3.5 rounded-xl border border-stone-300 bg-stone-50 font-mono text-sm text-stone-900 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          <Card
            title="Sao lưu Khóa Bí mật"
            subtitle="Mã hóa khóa bí mật bằng mật khẩu cá nhân và tải về máy để phòng trường hợp đổi thiết bị"
          >
            <form onSubmit={handleDownloadBackup} className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-base">
                <strong>Lưu ý bảo mật:</strong> Hệ thống không bao giờ lưu khóa bí mật lên máy chủ. Hãy đặt mật khẩu mạnh và cất giữ tệp <code className="font-mono">.json</code> cẩn thận.
              </div>

              <div>
                <label className="block font-bold text-stone-900 mb-1.5">
                  Mật khẩu bảo vệ tệp sao lưu *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="Nhập mật khẩu tối thiểu 6 ký tự..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <Button type="submit" variant="success" size="lg" disabled={!keyPair}>
                Tải tệp sao lưu khóa bí mật
              </Button>
              {!keyPair && (
                <p className="text-sm text-stone-600">
                  * Bạn cần bấm &ldquo;Tạo cặp khóa RSA mới&rdquo; ở khung bên trái trước khi sao lưu.
                </p>
              )}
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: DANH SÁCH HỒ SƠ & KIỂM TRA TOÀN VẸN */}
      {activeTab === "records" && (
        <Card
          title="Danh sách Hồ sơ Bệnh án của Tôi"
          subtitle="Đối chiếu mã băm toàn vẹn trên hệ thống lưu trữ với dữ liệu gốc trên Blockchain"
        >
          <Table headers={["Mã hồ sơ", "Loại khám", "Cơ sở y tế & Bác sĩ", "Ngày tạo", "Trạng thái ký", "Toàn vẹn dữ liệu"]}>
            {INITIAL_RECORDS.map((rec) => {
              const isVerified = verifiedMap[rec.id];
              return (
                <tr key={rec.id}>
                  <td className="py-4 px-4 font-bold">#{rec.id}</td>
                  <td className="py-4 px-4 font-semibold">{rec.metadata.recordType}</td>
                  <td className="py-4 px-4">
                    <div className="font-bold">{rec.facilityName}</div>
                    <div className="text-sm text-stone-600">{rec.doctorName}</div>
                  </td>
                  <td className="py-4 px-4">{rec.createdAt}</td>
                  <td className="py-4 px-4">
                    {rec.signed ? <Badge variant="success">Đã ký</Badge> : <Badge variant="warning">Chưa ký</Badge>}
                  </td>
                  <td className="py-4 px-4">
                    {isVerified ? (
                      <Badge variant="success">✓ Toàn vẹn dữ liệu</Badge>
                    ) : (
                      <Button type="button" variant="secondary" onClick={() => handleVerifyIntegrity(rec.id)}>
                        Kiểm tra toàn vẹn
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {/* TAB 3: YÊU CẦU CHỜ DUYỆT */}
      {activeTab === "requests" && (
        <Card
          title="Yêu cầu Truy cập Hồ sơ Chờ duyệt"
          subtitle="Chọn thời hạn hiệu lực từ 1 giờ đến 30 ngày trước khi phê duyệt cấp quyền xem cho bác sĩ"
        >
          {pendingRequests.length === 0 ? (
            <p className="text-base text-stone-700 py-4">Hiện không có yêu cầu nào đang chờ duyệt.</p>
          ) : (
            <Table headers={["Hồ sơ", "Bác sĩ yêu cầu", "Lý do khám", "Thời hạn cấp quyền", "Hành động"]}>
              {pendingRequests.map((req) => (
                <tr key={req.requestId}>
                  <td className="py-4 px-4 font-bold">#{req.recordId}</td>
                  <td className="py-4 px-4">
                    <div className="font-bold">{req.doctorName}</div>
                    <div className="text-sm text-stone-600">{req.hospitalName}</div>
                    <div className="text-sm font-mono text-stone-500">{req.doctorAddress.slice(0, 10)}...</div>
                  </td>
                  <td className="py-4 px-4 max-w-xs">{req.note}</td>
                  <td className="py-4 px-4">
                    <select
                      aria-label="Chọn thời hạn"
                      value={durations[req.requestId] || "7 ngày"}
                      onChange={(e) => setDurations({ ...durations, [req.requestId]: e.target.value })}
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
                      <Button type="button" variant="success" onClick={() => handleApproveRequest(req)}>
                        Duyệt
                      </Button>
                      <Button type="button" variant="danger" onClick={() => handleRejectRequest(req.requestId)}>
                        Từ chối
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 4: BÁC SĨ ĐANG CÓ QUYỀN */}
      {activeTab === "authorized" && (
        <Card
          title="Danh sách Bác sĩ Đang có Quyền Xem Hồ sơ"
          subtitle="Bạn có thể thu hồi quyền truy cập bất cứ lúc nào ngay cả khi chưa hết thời hạn"
        >
          <Table headers={["Hồ sơ", "Bác sĩ / Cơ sở y tế", "Hết hạn lúc", "Thời gian còn lại", "Thu hồi quyền"]}>
            {authorizedDoctors.map((doc, idx) => (
              <tr key={`${doc.recordId}-${doc.doctorAddress}-${idx}`}>
                <td className="py-4 px-4 font-bold">#{doc.recordId}</td>
                <td className="py-4 px-4">
                  <div className="font-bold">{doc.doctorName}</div>
                  <div className="text-sm text-stone-600">{doc.hospitalName}</div>
                  <div className="text-sm font-mono text-stone-500">{doc.doctorAddress.slice(0, 12)}...</div>
                </td>
                <td className="py-4 px-4">{doc.expiresAt}</td>
                <td className="py-4 px-4">
                  <Badge variant="info">Còn {doc.remainingText}</Badge>
                </td>
                <td className="py-4 px-4">
                  <Button type="button" variant="danger" onClick={() => handleRevokeDoctor(doc)}>
                    Thu hồi quyền
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* TAB 5: NHẬT KÝ TRUY CẬP (KHẨN CẤP TÔ ĐỎ) + CHỨNG NHẬN SBT + NGƯỜI GIÁM HỘ */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          <Card
            title="Nhật ký Truy cập Hồ sơ Bất biến"
            subtitle="Các lượt truy cập khẩn cấp được cảnh báo tô đỏ nổi bật kèm lý do y khoa"
          >
            <Table headers={["Thời gian", "Hồ sơ", "Người truy cập", "Phân loại", "Ghi chú / Lý do khẩn cấp"]}>
              {INITIAL_ACCESS_LOGS.map((log) => (
                <tr
                  key={log.logId}
                  className={log.emergency ? "bg-red-100/90 text-red-950 font-semibold" : ""}
                >
                  <td className="py-4 px-4 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-4 px-4 font-bold">#{log.recordId}</td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="font-bold">{log.accessorName}</div>
                    <div className="text-sm font-mono opacity-80">{log.accessor.slice(0, 12)}...</div>
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
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chứng nhận SBT đang sở hữu */}
            <Card
              title="Chứng nhận Y tế Định danh Soulbound"
              subtitle="Chứng nhận điện tử gắn vĩnh viễn với ví bệnh nhân, không thể chuyển nhượng"
            >
              <div className="space-y-3">
                {INITIAL_SBTS.map((sbt) => (
                  <div
                    key={sbt.tokenId}
                    className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-sm font-mono font-bold text-teal-800">
                        Mã chứng nhận #{sbt.tokenId} • {sbt.certType}
                      </span>
                      <h3 className="text-lg font-bold text-stone-950">{sbt.certLabel}</h3>
                      <p className="text-sm text-stone-700">
                        Cấp bởi: {sbt.issuedBy} • Hết hạn: {sbt.expiresAt}
                      </p>
                    </div>
                    <Badge variant="success">Hợp lệ</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chỉ định người giám hộ */}
            <Card
              title="Chỉ định Người giám hộ Khôi phục Ví"
              subtitle="Phòng trường hợp mất khóa bí mật: cần đủ số phiếu giám hộ phê duyệt để chuyển hồ sơ sang ví mới"
            >
              <div className="space-y-4">
                <div className="space-y-2">
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
                    className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
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
                    onClick={() =>
                      showToast(`Đã lưu danh sách ${guardians.length} người giám hộ (ngưỡng ${threshold} phiếu)!`)
                    }
                  >
                    Lưu giám hộ
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