"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  INITIAL_RECORDS,
  MOCK_WALLETS,
  MedicalRecordItem,
  DhrMetadata,
} from "@/mock/dhrData";

export default function DoctorPage() {
  const [activeTab, setActiveTab] = useState<"create" | "view">("create");
  const [records, setRecords] = useState<MedicalRecordItem[]>(INITIAL_RECORDS);
  const [toast, setToast] = useState<string | null>(null);

  // Form state theo đúng docs/schema/metadata.schema.json
  const [patientId, setPatientId] = useState(MOCK_WALLETS.patient);
  const [recordType, setRecordType] = useState<DhrMetadata["recordType"]>("XRAY");
  const [examDate, setExamDate] = useState("2026-11-19");
  const [sex, setSex] = useState<NonNullable<DhrMetadata["sex"]>>("FEMALE");
  const [birthYear, setBirthYear] = useState(2005);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(65);
  const [waistCm, setWaistCm] = useState(72);
  const [bloodType, setBloodType] = useState<NonNullable<DhrMetadata["anthropometrics"]["bloodType"]>>("O+");
  const [systolic, setSystolic] = useState(118);
  const [diastolic, setDiastolic] = useState(76);
  const [heartRateBpm, setHeartRateBpm] = useState(74);

  const [imageFileName, setImageFileName] = useState("xquang-phoi-2026.png");
  const [pdfFileName, setPdfFileName] = useState("tom-tat-benh-an-2026.pdf");
  const [createdDraft, setCreatedDraft] = useState<MedicalRecordItem | null>(null);

  // State cho Tab Tra cứu & Xem hồ sơ
  const [searchQuery, setSearchQuery] = useState("1");
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordItem>(INITIAL_RECORDS[0]);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyUnlocked, setEmergencyUnlocked] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const computedBmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)) || 0;

  const generatedMetadata: DhrMetadata = {
    schemaVersion: "1.0.0",
    patientId,
    doctorId: MOCK_WALLETS.doctor1,
    facilityId: MOCK_WALLETS.hospital,
    recordType,
    examDate,
    sex,
    birthYear,
    anthropometrics: {
      heightCm,
      weightKg,
      bmi: computedBmi,
      waistCm,
      bloodType,
      bloodPressure: { systolic, diastolic },
      heartRateBpm,
    },
  };

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = records.length + 1;
    const newRec: MedicalRecordItem = {
      id: newId,
      patient: patientId,
      doctor: MOCK_WALLETS.doctor1,
      doctorName: "BS. CKII Trần Minh Quân",
      facilityName: "BV Đa khoa Quốc tế Sài Gòn",
      imageCid: "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      imageHash: "0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b",
      imageUrl: "/mock/xquang-mau.png",
      pdfCid: "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccjlsu",
      pdfHash: "0x3c91f8b2d47e10a95f82e6b1c7a49d80e2f1b3c5d7e9a0b2c4d6e8f0a1b3c5d7",
      pdfUrl: "/mock/tom-tat-benh-an-mau.pdf",
      metadataCid: "bafybeif2uy42342342342342342342342342342342342342342342342c",
      metadataHash: "0x5f4dcc3b5aa765d61d8327deb882cf99b4a8d9e0f1a2b3c4d5e6f7a8b9c0d1e2",
      signed: false,
      createdAt: "2026-11-19 14:30",
      previousRecordId: 0,
      metadata: generatedMetadata,
    };
    setRecords([newRec, ...records]);
    setCreatedDraft(newRec);
    showToast(`Đã mã hóa dữ liệu, tải 3 tệp lên IPFS và khởi tạo thành công Hồ sơ #${newId}`);
  };

  const handleSignRecord = (id: number) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, signed: true } : r)));
    if (createdDraft && createdDraft.id === id) {
      setCreatedDraft({ ...createdDraft, signed: true });
    }
    showToast(`Hồ sơ #${id} đã được ký xác nhận và khóa bất biến trên Blockchain!`);
  };

  const handleRequestAccess = () => {
    showToast(`Đã gửi yêu cầu xem hồ sơ #${searchQuery} tới ví bệnh nhân chờ phê duyệt.`);
  };

  const handleConfirmEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyReason.trim()) return;
    setEmergencyUnlocked(true);
    setEmergencyModalOpen(false);
    showToast(
      `Đã kích hoạt truy cập khẩn cấp cho Hồ sơ #${selectedRecord.id} — Quyền mở trong 24 giờ và đã gửi cảnh báo tới bệnh nhân!`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header trang Bác sĩ */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <Badge variant="info">DOCTOR_ROLE</Badge>
            <span className="text-base text-stone-600 font-medium">BS. CKII Trần Minh Quân</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            Cổng Làm việc Bác sĩ
          </h1>
        </div>

        {/* Chuyển Tab rõ ràng */}
        <div className="flex bg-stone-100 p-1.5 rounded-xl border border-stone-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2.5 rounded-lg text-base font-semibold transition-all cursor-pointer ${
              activeTab === "create"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-stone-800 hover:bg-white/70"
            }`}
          >
            1. Tạo & Ký hồ sơ mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("view")}
            className={`px-4 py-2.5 rounded-lg text-base font-semibold transition-all cursor-pointer ${
              activeTab === "view"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-stone-800 hover:bg-white/70"
            }`}
          >
            2. Tra cứu & Xem bệnh án
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-semibold text-base shadow-sm">
          ✓ {toast}
        </div>
      )}

      {/* TAB 1: FORM UPLOAD 3 FILE + METADATA JSON + KÝ XÁC NHẬN */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateRecord} className="lg:col-span-7 space-y-6">
            <Card
              title="Khởi tạo Hồ sơ Y tế Mới"
              subtitle="Dữ liệu được băm toàn vẹn và mã hóa đầu cuối trước khi tải lên IPFS"
            >
              <div className="space-y-5">
                {/* Địa chỉ ví bệnh nhân */}
                <div>
                  <label className="block font-bold text-stone-900 mb-1.5">
                    Địa chỉ ví Bệnh nhân *
                  </label>
                  <input
                    type="text"
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base text-stone-950 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                {/* Thông tin hành chính phi định danh */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-900 mb-1.5">Loại hồ sơ</label>
                    <select
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value as DhrMetadata["recordType"])}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-base text-stone-950 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="XRAY">Chụp X-Quang</option>
                      <option value="ULTRASOUND">Siêu âm</option>
                      <option value="GENERAL_CHECKUP">Khám tổng quát</option>
                      <option value="LAB_TEST">Xét nghiệm</option>
                      <option value="VACCINATION">Tiêm chủng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-900 mb-1.5">Ngày khám</label>
                    <input
                      type="date"
                      required
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base text-stone-950 focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-900 mb-1.5">Giới tính</label>
                    <select
                      value={sex}
                      onChange={(e) => setSex(e.target.value as NonNullable<DhrMetadata["sex"]>)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-base text-stone-950 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="FEMALE">Nữ</option>
                      <option value="MALE">Nam</option>
                      <option value="OTHER">Khác</option>
                      <option value="UNDISCLOSED">Không tiết lộ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-900 mb-1.5">Năm sinh</label>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={birthYear}
                      onChange={(e) => setBirthYear(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base text-stone-950 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Chỉ số nhân trắc học */}
                <div className="pt-2 border-t border-stone-200">
                  <h3 className="text-lg font-extrabold text-stone-950 mb-3">
                    Chỉ số Nhân trắc học & Sinh hiệu
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Chiều cao (cm)</label>
                      <input
                        type="number"
                        value={heightCm}
                        onChange={(e) => setHeightCm(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Cân nặng (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Chỉ số BMI</label>
                      <input
                        type="text"
                        readOnly
                        value={computedBmi}
                        className="w-full px-3.5 py-2 rounded-xl border-2 border-stone-200 bg-stone-100 font-bold text-teal-800 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Vòng eo (cm)</label>
                      <input
                        type="number"
                        value={waistCm}
                        onChange={(e) => setWaistCm(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Nhóm máu</label>
                      <select
                        value={bloodType}
                        onChange={(e) =>
                          setBloodType(e.target.value as NonNullable<DhrMetadata["anthropometrics"]["bloodType"]>)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-base"
                      >
                        {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((bt) => (
                          <option key={bt} value={bt}>{bt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Nhịp tim (lần/phút)</label>
                      <input
                        type="number"
                        value={heartRateBpm}
                        onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Huyết áp tâm thu</label>
                      <input
                        type="number"
                        value={systolic}
                        onChange={(e) => setSystolic(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-800 mb-1">Huyết áp tâm trương</label>
                      <input
                        type="number"
                        value={diastolic}
                        onChange={(e) => setDiastolic(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Upload 2 file đính kèm (Ảnh X-Quang & PDF) */}
                <div className="pt-2 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50">
                    <label className="block font-bold text-stone-950 mb-1">
                      1. Tệp Ảnh X-Quang / Siêu âm *
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setImageFileName(e.target.files?.[0]?.name || imageFileName)}
                      className="block w-full text-base text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-semibold file:bg-teal-700 file:text-white cursor-pointer"
                    />
                    <span className="text-sm text-stone-700 mt-1.5 block font-mono truncate">
                      Đã chọn: {imageFileName}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50">
                    <label className="block font-bold text-stone-950 mb-1">
                      2. Tệp PDF Tóm tắt bệnh án *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFileName(e.target.files?.[0]?.name || pdfFileName)}
                      className="block w-full text-base text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-semibold file:bg-teal-700 file:text-white cursor-pointer"
                    />
                    <span className="text-sm text-stone-700 mt-1.5 block font-mono truncate">
                      Đã chọn: {pdfFileName}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <Button type="submit" variant="primary" size="lg">
                    Mã hóa & Tải lên IPFS
                  </Button>
                </div>
              </div>
            </Card>
          </form>

          {/* Cột phải: Xem trước JSON Schema & Nút Ký xác nhận */}
          <div className="lg:col-span-5 space-y-6">
            <Card
              title="3. Dữ liệu Chỉ số Nhân trắc (JSON)"
              subtitle="Tự động đóng gói theo chuẩn hệ thống trước khi mã hóa"
            >
              <pre className="bg-stone-950 text-emerald-300 p-4 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed max-h-96">
                {JSON.stringify(generatedMetadata, null, 2)}
              </pre>
            </Card>

            <Card
              title="Trạng thái Ký xác nhận"
              subtitle="Sau khi bác sĩ ký, hồ sơ trở nên bất biến trên Blockchain"
            >
              {createdDraft ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-950">Hồ sơ #{createdDraft.id}</span>
                    {createdDraft.signed ? (
                      <Badge variant="success">ĐÃ KÝ XÁC NHẬN (BẤT BIẾN)</Badge>
                    ) : (
                      <Badge variant="warning">CHỜ KÝ XÁC NHẬN</Badge>
                    )}
                  </div>
                  <p className="text-base text-stone-700">
                    {createdDraft.signed
                      ? "Hồ sơ đã khóa chỉnh sửa. Mọi thay đổi sau này phải tạo bản ghi mới."
                      : "Vui lòng kiểm tra kỹ thông số và bấm nút bên dưới để ký xác nhận lên hệ thống."}
                  </p>
                  <Button
                    type="button"
                    variant="success"
                    size="lg"
                    disabled={createdDraft.signed}
                    onClick={() => handleSignRecord(createdDraft.id)}
                    className="w-full"
                  >
                    {createdDraft.signed ? "✓ Đã ký xác nhận" : "Ký xác nhận hồ sơ"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-base text-stone-700">
                    Hồ sơ nháp gần nhất: <strong>Hồ sơ #2</strong> (Chưa ký xác nhận)
                  </p>
                  <Button
                    type="button"
                    variant="success"
                    disabled={records.find((r) => r.id === 2)?.signed}
                    onClick={() => handleSignRecord(2)}
                    className="w-full"
                  >
                    {records.find((r) => r.id === 2)?.signed
                      ? "✓ Hồ sơ #2 đã ký xác nhận"
                      : "Ký xác nhận Hồ sơ #2"}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TRA CỨU, YÊU CẦU QUYỀN, XEM HỒ SƠ & TRUY CẬP KHẨN CẤP */}
      {activeTab === "view" && (
        <div className="space-y-6">
          {/* Thanh tìm kiếm & Yêu cầu quyền */}
          <Card
            title="Tra cứu Hồ sơ Cũ & Yêu cầu Quyền Truy cập"
            subtitle="Nhập mã hồ sơ hoặc địa chỉ ví bệnh nhân để gửi yêu cầu xem bệnh án"
          >
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập mã hồ sơ (vd: 1) hoặc ví bệnh nhân 0x..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 text-base font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const found = records.find(
                    (r) => String(r.id) === searchQuery.trim() || r.patient.toLowerCase() === searchQuery.trim().toLowerCase()
                  );
                  if (found) setSelectedRecord(found);
                  showToast("Đã tải thông tin hồ sơ từ hệ thống.");
                }}
              >
                Tìm hồ sơ
              </Button>
              <Button type="button" variant="primary" onClick={handleRequestAccess}>
                Yêu cầu quyền xem
              </Button>
              <Button type="button" variant="danger" onClick={() => setEmergencyModalOpen(true)}>
                Truy cập khẩn cấp
              </Button>
            </div>
          </Card>

          {/* Màn hình xem chi tiết hồ sơ */}
          <Card
            title={`Chi tiết Bệnh án #${selectedRecord.id} — ${selectedRecord.metadata.recordType}`}
            subtitle={`Bệnh nhân: ${selectedRecord.patient} • Ngày khám: ${selectedRecord.metadata.examDate}`}
            action={
              <div className="flex flex-wrap gap-2">
                {emergencyUnlocked && <Badge variant="danger">ĐANG MỞ KHẨN CẤP (24H)</Badge>}
                {selectedRecord.signed ? (
                  <Badge variant="success">Đã ký xác nhận</Badge>
                ) : (
                  <Badge variant="warning">Chưa ký</Badge>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cột 1: Ảnh X-Quang */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-lg font-bold text-stone-950">1. Hình ảnh Y tế</h3>
                <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-950 aspect-square flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedRecord.imageUrl}
                    alt="Ảnh X-quang bệnh nhân"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm font-mono text-stone-600 break-all">
                  Mã lưu trữ IPFS: {selectedRecord.imageCid}
                </p>
              </div>

              {/* Cột 2: File PDF Tóm tắt */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-lg font-bold text-stone-950">2. Tóm tắt Bệnh án (PDF)</h3>
                <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-100 aspect-square">
                  <iframe
                    src={selectedRecord.pdfUrl}
                    title="Tóm tắt bệnh án PDF"
                    className="w-full h-full"
                  />
                </div>
                <a
                  href={selectedRecord.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-base font-semibold text-teal-700 hover:underline"
                >
                  Mở tệp PDF toàn màn hình ↗
                </a>
              </div>

              {/* Cột 3: Chỉ số JSON giải mã */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-lg font-bold text-stone-950">3. Chỉ số Nhân trắc</h3>
                <div className="rounded-xl border-2 border-stone-200 bg-stone-50 p-4 space-y-2.5 text-base">
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Giới tính / Năm sinh:</span>
                    <span className="font-bold">
                      {selectedRecord.metadata.sex === "FEMALE" ? "Nữ" : selectedRecord.metadata.sex === "MALE" ? "Nam" : "Khác"} • {selectedRecord.metadata.birthYear}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Chiều cao / Cân nặng:</span>
                    <span className="font-bold">
                      {selectedRecord.metadata.anthropometrics.heightCm} cm / {selectedRecord.metadata.anthropometrics.weightKg} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Chỉ số BMI:</span>
                    <span className="font-bold text-teal-700">{selectedRecord.metadata.anthropometrics.bmi}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Nhóm máu:</span>
                    <span className="font-bold text-red-700">{selectedRecord.metadata.anthropometrics.bloodType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Huyết áp:</span>
                    <span className="font-bold">
                      {selectedRecord.metadata.anthropometrics.bloodPressure?.systolic}/
                      {selectedRecord.metadata.anthropometrics.bloodPressure?.diastolic} mmHg
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-stone-600">Nhịp tim:</span>
                    <span className="font-bold">{selectedRecord.metadata.anthropometrics.heartRateBpm} lần/phút</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Truy cập khẩn cấp */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <span className="text-2xl">🚨</span>
              <h2 className="text-xl font-extrabold">Xác nhận Truy cập Khẩn cấp</h2>
            </div>
            <p className="text-base text-stone-800 leading-relaxed">
              Hành động này sẽ mở quyền xem hồ sơ khẩn cấp trong <strong>24 giờ</strong>, gửi cảnh báo ngay lập tức tới bệnh nhân và ghi vĩnh viễn vào nhật ký kiểm toán.
            </p>
            <form onSubmit={handleConfirmEmergency} className="space-y-4">
              <div>
                <label className="block font-bold text-stone-950 mb-1.5">
                  Lý do y khoa khẩn cấp (Bắt buộc) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  placeholder="Ví dụ: Bệnh nhân nhập viện cấp cứu trong tình trạng hôn mê, cần kiểm tra nhóm máu và tiền sử dị ứng thuốc..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-red-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setEmergencyModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="danger">
                  Xác nhận Truy cập Khẩn cấp
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}