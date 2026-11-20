"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { MOCK_WALLETS } from "@/mock/dhrData";

export default function HospitalPage() {
  const [toast, setToast] = useState<string | null>(null);

  // 1. Cấp vai trò bác sĩ
  const [doctorWallet, setDoctorWallet] = useState(MOCK_WALLETS.doctor2);
  const [doctorName, setDoctorName] = useState("BS. Lê Hoàng Nam");
  const [grantedDoctors, setGrantedDoctors] = useState([
    { wallet: MOCK_WALLETS.doctor1, name: "BS. CKII Trần Minh Quân", status: "Đang hoạt động" },
  ]);

  // 2. Mint SBT
  const [sbtPatientWallet, setSbtPatientWallet] = useState(MOCK_WALLETS.patient);
  const [certType, setCertType] = useState("HEALTH_CHECK_OK");
  const [expiresDate, setExpiresDate] = useState("2027-11-19");

  // 3. Giao khóa khẩn cấp
  const [emergencyQueue, setEmergencyQueue] = useState([
    {
      recordId: 1,
      doctorWallet: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
      doctorName: "BS. Trực Cấp Cứu - Đặng Văn Hùng",
      reason: "Bệnh nhân ngất xỉu tại phòng cấp cứu",
      delivered: false,
    },
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleGrantDoctorRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorWallet.trim()) return;
    setGrantedDoctors([
      { wallet: doctorWallet.trim(), name: doctorName || "Bác sĩ mới", status: "Đang hoạt động" },
      ...grantedDoctors,
    ]);
    showToast(`Đã cấp quyền Bác sĩ cho địa chỉ ví ${doctorWallet} thành công!`);
  };

  const handleMintSbt = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(`Đã phát hành chứng nhận sức khỏe "${certType}" cho ví ${sbtPatientWallet}!`);
  };

  const handleDeliverKey = (recordId: number, doctor: string) => {
    setEmergencyQueue((prev) =>
      prev.map((item) => (item.recordId === recordId ? { ...item, delivered: true } : item))
    );
    showToast(`Đã giao khóa giải mã khẩn cấp Hồ sơ #${recordId} cho ${doctor}!`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <Badge variant="info">HOSPITAL_ROLE</Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 mt-2">
          Cổng Quản trị Cơ sở Y tế
        </h1>
        <p className="text-base text-stone-700 mt-1">
          BV Đa khoa Quốc tế Sài Gòn • Quản lý phân quyền bác sĩ, phát hành chứng nhận sức khỏe và điều phối khóa cấp cứu
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-500 text-emerald-950 font-semibold text-base">
          ✓ {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Cấp vai trò bác sĩ */}
        <Card
          title="1. Cấp vai trò Bác sĩ"
          subtitle="Xác thực và cấp quyền hành nghề trên hệ thống cho bác sĩ thuộc bệnh viện"
        >
          <form onSubmit={handleGrantDoctorRole} className="space-y-4">
            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Địa chỉ ví Bác sĩ *</label>
              <input
                type="text"
                required
                value={doctorWallet}
                onChange={(e) => setDoctorWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Ghi chú định danh nội bộ</label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="VD: BS. Nguyễn Văn A - Khoa Nội"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Cấp quyền Bác sĩ
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-stone-200 space-y-2">
            <span className="font-bold text-stone-900 block">Bác sĩ đã cấp quyền:</span>
            {grantedDoctors.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <div className="font-bold text-stone-950">{d.name}</div>
                  <div className="font-mono text-sm text-stone-600">{d.wallet.slice(0, 14)}...</div>
                </div>
                <Badge variant="success">{d.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* 2. Mint chứng nhận SBT */}
        <Card
          title="2. Phát hành Chứng nhận Sức khỏe"
          subtitle="Cấp chứng nhận Soulbound không thể chuyển nhượng gắn liền với ví bệnh nhân"
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
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
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
                <option value="TREATMENT_COMPLETED">Chứng nhận Hoàn thành Lộ trình Điều trị</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-stone-900 mb-1.5">Ngày hết hạn hiệu lực</label>
              <input
                type="date"
                required
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>

            <Button type="submit" variant="success" size="lg" className="w-full">
              Phát hành Chứng nhận SBT
            </Button>
          </form>
        </Card>
      </div>

      {/* 3. Giao khóa khẩn cấp cho bác sĩ */}
      <Card
        title="3. Điều phối Khóa Giải mã Khẩn cấp"
        subtitle="Bệnh viện xác nhận tình huống cấp cứu và cấp khóa giải mã tạm thời cho bác sĩ trực"
      >
        <Table headers={["Hồ sơ", "Bác sĩ yêu cầu cấp cứu", "Lý do khẩn cấp", "Trạng thái", "Thao tác"]}>
          {emergencyQueue.map((item) => (
            <tr key={item.recordId}>
              <td className="py-4 px-4 font-bold">#{item.recordId}</td>
              <td className="py-4 px-4">
                <div className="font-bold">{item.doctorName}</div>
                <div className="text-sm font-mono text-stone-600">{item.doctorWallet.slice(0, 14)}...</div>
              </td>
              <td className="py-4 px-4 text-red-900 font-medium">{item.reason}</td>
              <td className="py-4 px-4">
                {item.delivered ? (
                  <Badge variant="success">Đã giao khóa giải mã</Badge>
                ) : (
                  <Badge variant="danger">Đang chờ giao khóa</Badge>
                )}
              </td>
              <td className="py-4 px-4">
                <Button
                  type="button"
                  variant="danger"
                  disabled={item.delivered}
                  onClick={() => handleDeliverKey(item.recordId, item.doctorName)}
                >
                  {item.delivered ? "✓ Đã giao khóa" : "Giao khóa khẩn cấp"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}