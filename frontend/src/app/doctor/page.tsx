"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { KeyPanel } from "@/components/KeyPanel";
import { useWallet } from "@/context/WalletContext";
import { useKeys } from "@/context/KeyContext";
import {
  createRecordFlow,
  signRecordFlow,
  getPatientRecords,
  requestAccessFlow,
  emergencyAccessFlow,
  retrieveRecordFlow,
  type RetrievedRecord,
} from "@/lib/dhr";
import {
  displayName,
  displayOrg,
  shortAddress,
} from "@/lib/directory";
import { EXPLORER_TX } from "@/lib/web3";

type RecordTypeKey = "XRAY" | "ULTRASOUND" | "GENERAL_CHECKUP" | "LAB_TEST" | "VACCINATION";
type SexKey = "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
type BloodTypeKey = "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-";

type PatientRecordSummary = {
  id: bigint;
  doctor: string;
  signed: boolean;
  createdAt: Date;
  previousRecordId: bigint;
};

const HOSPITAL_ADDRESS = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";

export default function DoctorPage() {
  const { address, signer, roles } = useWallet();
  const { privateKey } = useKeys();

  const [activeTab, setActiveTab] = useState<"create" | "view">("create");

  // Thông báo trạng thái, tiến trình từng bước, lỗi đỏ & link Etherscan
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state theo schema chuẩn
  const [patientId, setPatientId] = useState("0x1E3d9eA7c2a1e9eA970e3a0691147Ec7990A5CE5");
  const [recordType, setRecordType] = useState<RecordTypeKey>("XRAY");
  const [examDate, setExamDate] = useState("2026-11-20");
  const [sex, setSex] = useState<SexKey>("FEMALE");
  const [birthYear, setBirthYear] = useState(2005);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(65);
  const [waistCm, setWaistCm] = useState(72);
  const [bloodType, setBloodType] = useState<BloodTypeKey>("O+");
  const [systolic, setSystolic] = useState(118);
  const [diastolic, setDiastolic] = useState(76);
  const [heartRateBpm, setHeartRateBpm] = useState(74);

  // File thật (Image & PDF)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  // Hồ sơ vừa tạo trên chuỗi (chờ ký hoặc đã ký)
  const [createdRecord, setCreatedRecord] = useState<{
    id: bigint;
    signed: boolean;
    cids: string[];
  } | null>(null);

  // State cho Tab 2: Tra cứu theo ví bệnh nhân, yêu cầu quyền, khẩn cấp & giải mã xem hồ sơ
  const [searchPatient, setSearchPatient] = useState("0x1E3d9eA7c2a1e9eA970e3a0691147Ec7990A5CE5");
  const [patientRecords, setPatientRecords] = useState<PatientRecordSummary[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<bigint | null>(null);
  const [retrievedData, setRetrievedData] = useState<RetrievedRecord | null>(null);

  // Modal truy cập khẩn cấp
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyTargetId, setEmergencyTargetId] = useState<bigint | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");

  const resetFeedback = () => {
    setStepMsg(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setTxHash(null);
  };

  const computedBmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)) || 0;

  const generatedMetadata = {
    schemaVersion: "1.0.0",
    patientId: patientId.trim(),
    doctorId: address ?? "",
    facilityId: HOSPITAL_ADDRESS,
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

  // Tải 2 file mẫu từ public/mock thành đối tượng File thật
  const handleUseSampleFiles = async () => {
    resetFeedback();
    setLoadingSample(true);
    try {
      const [imgRes, pdfRes] = await Promise.all([
        fetch("/mock/xquang-mau.png"),
        fetch("/mock/tom-tat-benh-an-mau.pdf"),
      ]);
      if (!imgRes.ok || !pdfRes.ok) {
        throw new Error("Không tìm thấy tệp mẫu trong thư mục public/mock.");
      }
      const [imgBlob, pdfBlob] = await Promise.all([imgRes.blob(), pdfRes.blob()]);
      setImageFile(new File([imgBlob], "xquang-mau.png", { type: "image/png" }));
      setPdfFile(new File([pdfBlob], "tom-tat-benh-an-mau.pdf", { type: "application/pdf" }));
      setSuccessMsg("Đã nạp sẵn tệp ảnh X-Quang mẫu và tệp PDF mẫu!");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSample(false);
    }
  };

  // Tạo hồ sơ thật lên IPFS + Sepolia
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !address) {
      setErrorMsg("Vui lòng kết nối ví MetaMask của Bác sĩ trước.");
      return;
    }
    if (!imageFile || !pdfFile) {
      setErrorMsg("Vui lòng chọn đủ tệp Ảnh y tế và tệp PDF tóm tắt (hoặc bấm 'Dùng file mẫu').");
      return;
    }

    resetFeedback();
    setBusy(true);
    try {
      const res = await createRecordFlow({
        signer,
        patient: patientId.trim(),
        image: imageFile,
        pdf: pdfFile,
        metadata: generatedMetadata,
        onStep: (msg) => setStepMsg(msg),
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status !== "confirmed") setStepMsg("Đã gửi giao dịch lên mạng Sepolia, đang chờ xác nhận...");
        },
      });
      setStepMsg(null);
      setCreatedRecord({ id: res.recordId, signed: false, cids: res.cids });
      setSuccessMsg(`Đã tạo thành công Hồ sơ #${res.recordId.toString()} trên Blockchain & IPFS!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Ký xác nhận hồ sơ thật
  const handleSignRecord = async (recordId: bigint) => {
    if (!signer) return;
    resetFeedback();
    setBusy(true);
    try {
      await signRecordFlow(signer, recordId, (status, hash) => {
        if (hash) setTxHash(hash);
        if (status !== "confirmed") setStepMsg("Đang gửi giao dịch ký xác nhận lên Sepolia...");
      });
      setStepMsg(null);
      setCreatedRecord((prev) => (prev && prev.id === recordId ? { ...prev, signed: true } : prev));
      setPatientRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, signed: true } : r))
      );
      setSuccessMsg(`Đã ký xác nhận Hồ sơ #${recordId.toString()} — Dữ liệu đã khóa bất biến!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Tìm danh sách hồ sơ theo địa chỉ ví bệnh nhân
  const handleSearchPatient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!signer) {
      setErrorMsg("Vui lòng kết nối ví MetaMask để tra cứu hồ sơ trên chuỗi.");
      return;
    }
    if (!searchPatient.trim()) return;

    resetFeedback();
    setRetrievedData(null);
    setBusy(true);
    try {
      const list = await getPatientRecords(signer, searchPatient.trim());
      setPatientRecords(list);
      if (list.length === 0) {
        setErrorMsg("Địa chỉ ví bệnh nhân này chưa có hồ sơ nào trên hệ thống.");
      } else {
        setSuccessMsg(`Tìm thấy ${list.length} hồ sơ của bệnh nhân ${shortAddress(searchPatient.trim())}.`);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Gửi yêu cầu xin quyền xem hồ sơ
  const handleRequestAccess = async (recordId: bigint) => {
    if (!signer) return;
    resetFeedback();
    setBusy(true);
    try {
      await requestAccessFlow(signer, recordId, (status, hash) => {
        if (hash) setTxHash(hash);
        if (status !== "confirmed") setStepMsg("Đang gửi yêu cầu truy cập tới bệnh nhân...");
      });
      setStepMsg(null);
      setSuccessMsg(`Đã gửi yêu cầu xem Hồ sơ #${recordId.toString()} tới ví bệnh nhân!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Kích hoạt truy cập khẩn cấp
  const handleConfirmEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || emergencyTargetId === null || !emergencyReason.trim()) return;

    resetFeedback();
    setBusy(true);
    try {
      await emergencyAccessFlow(signer, emergencyTargetId, emergencyReason.trim(), (status, hash) => {
        if (hash) setTxHash(hash);
        if (status !== "confirmed") setStepMsg("Đang ghi nhận truy cập khẩn cấp lên chuỗi khối...");
      });
      setStepMsg(null);
      setEmergencyModalOpen(false);
      setEmergencyReason("");
      setSuccessMsg(
        `Đã kích hoạt truy cập khẩn cấp Hồ sơ #${emergencyTargetId.toString()} (hiệu lực 24 giờ). Chờ bệnh viện giao khóa giải mã!`
      );
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Giải mã & xem chi tiết hồ sơ + kiểm tra toàn vẹn 3 file
  const handleRetrieveAndView = async (recordId: bigint) => {
    if (!signer) {
      setErrorMsg("Vui lòng kết nối ví MetaMask.");
      return;
    }
    if (!privateKey) {
      setErrorMsg("Bạn chưa nạp khóa bí mật RSA trong phiên làm việc. Vui lòng tạo hoặc nạp khóa ở khung bên trên.");
      return;
    }

    resetFeedback();
    setSelectedRecordId(recordId);
    setBusy(true);
    try {
      const data = await retrieveRecordFlow({
        signer,
        recordId,
        myPrivateKey: privateKey,
        onStep: (msg) => setStepMsg(msg),
        onStatus: (status, hash) => {
          if (hash) setTxHash(hash);
          if (status !== "confirmed") setStepMsg("Đang ghi nhật ký truy cập lên blockchain...");
        },
      });
      setStepMsg(null);
      setRetrievedData(data);
      setSuccessMsg(`Đã giải mã và xác thực toàn vẹn Hồ sơ #${recordId.toString()} thành công!`);
    } catch (e) {
      setStepMsg(null);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header trang Bác sĩ */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            {roles.isDoctor ? (
              <Badge variant="success">Đã xác thực Bác sĩ</Badge>
            ) : (
              <Badge variant="warning">Chưa cấp quyền Bác sĩ</Badge>
            )}
            <span className="text-base text-stone-700 font-semibold">
              {address ? `${displayName(address)}${displayOrg(address) ? ` • ${displayOrg(address)}` : ""}` : "Chưa kết nối ví"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            Cổng Làm việc Bác sĩ
          </h1>
        </div>

        {/* Chuyển Tab */}
        <div className="flex bg-stone-100 p-1.5 rounded-xl border border-stone-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              setActiveTab("create");
            }}
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
            onClick={() => {
              resetFeedback();
              setActiveTab("view");
            }}
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

      {/* Khung quản lý khóa RSA dùng chung */}
      <KeyPanel />

      {/* Các thanh thông báo tiến trình / thành công / lỗi + link Etherscan */}
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

      {/* TAB 1: FORM UPLOAD 3 FILE THẬT + METADATA JSON + KÝ XÁC NHẬN */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateRecord} className="lg:col-span-7 space-y-6">
            <Card
              title="Khởi tạo Hồ sơ Y tế Mới"
              subtitle="Dữ liệu được băm toàn vẹn, mã hóa đầu cuối và tải lên IPFS trước khi ghi lên Sepolia"
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUseSampleFiles}
                  disabled={loadingSample || busy}
                >
                  {loadingSample ? "Đang nạp mẫu..." : "Dùng file mẫu"}
                </Button>
              }
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
                      onChange={(e) => setRecordType(e.target.value as RecordTypeKey)}
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
                      onChange={(e) => setSex(e.target.value as SexKey)}
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
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-100 font-bold text-teal-800 text-base"
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
                        onChange={(e) => setBloodType(e.target.value as BloodTypeKey)}
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

                {/* Upload 2 file thật đính kèm */}
                <div className="pt-2 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-dashed border-teal-400 bg-teal-50/40">
                    <label className="block font-bold text-stone-950 mb-1">
                      1. Tệp Ảnh X-Quang / Siêu âm *
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="block w-full text-base text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-semibold file:bg-teal-700 file:text-white cursor-pointer"
                    />
                    <span className="text-sm text-stone-700 mt-1.5 block font-mono truncate">
                      {imageFile ? `Đã chọn: ${imageFile.name}` : "Chưa chọn tệp ảnh"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/40">
                    <label className="block font-bold text-stone-950 mb-1">
                      2. Tệp PDF Tóm tắt bệnh án *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="block w-full text-base text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-semibold file:bg-teal-700 file:text-white cursor-pointer"
                    />
                    <span className="text-sm text-stone-700 mt-1.5 block font-mono truncate">
                      {pdfFile ? `Đã chọn: ${pdfFile.name}` : "Chưa chọn tệp PDF"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={!signer || !imageFile || !pdfFile || busy}
                  >
                    {busy ? "Đang xử lý..." : "Mã hóa & Tải lên IPFS"}
                  </Button>
                </div>
              </div>
            </Card>
          </form>

          {/* Cột phải: Xem trước JSON Schema & Ký xác nhận hồ sơ vừa tạo */}
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
              {createdRecord ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-950">Hồ sơ #{createdRecord.id.toString()}</span>
                    {createdRecord.signed ? (
                      <Badge variant="success">ĐÃ KÝ XÁC NHẬN (BẤT BIẾN)</Badge>
                    ) : (
                      <Badge variant="warning">CHỜ KÝ XÁC NHẬN</Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1 break-all">
                    <div>CID Ảnh: {createdRecord.cids[0]}</div>
                    <div>CID PDF: {createdRecord.cids[1]}</div>
                    <div>CID JSON: {createdRecord.cids[2]}</div>
                  </div>
                  <Button
                    type="button"
                    variant="success"
                    size="lg"
                    disabled={createdRecord.signed || busy}
                    onClick={() => void handleSignRecord(createdRecord.id)}
                    className="w-full"
                  >
                    {createdRecord.signed ? "✓ Đã ký xác nhận" : "Ký xác nhận hồ sơ"}
                  </Button>
                </div>
              ) : (
                <p className="text-base text-stone-600">
                  Sau khi khởi tạo hồ sơ ở khung bên trái, nút ký xác nhận giao dịch lên Sepolia sẽ hiển thị tại đây.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TRA CỨU THEO VÍ BỆNH NHÂN, YÊU CẦU QUYỀN, KHẨN CẤP & XEM HỒ SƠ GIẢI MÃ */}
      {activeTab === "view" && (
        <div className="space-y-6">
          <Card
            title="Tra cứu Hồ sơ Bệnh nhân trên Chuỗi khối"
            subtitle="Nhập địa chỉ ví bệnh nhân để xem danh sách hồ sơ, gửi yêu cầu quyền hoặc mở khẩn cấp"
          >
            <form onSubmit={handleSearchPatient} className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                required
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                placeholder="Nhập địa chỉ ví bệnh nhân 0x..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 text-base font-mono focus:border-teal-600 focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={!signer || busy}>
                {busy ? "Đang tải..." : "Tìm hồ sơ bệnh nhân"}
              </Button>
            </form>

            {/* Danh sách hồ sơ tìm được */}
            {patientRecords.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-bold text-stone-900">
                  Danh sách hồ sơ tìm thấy ({patientRecords.length}):
                </h3>
                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
                  {patientRecords.map((rec) => (
                    <div
                      key={rec.id.toString()}
                      className="p-4 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-extrabold text-lg text-stone-950">
                            Hồ sơ #{rec.id.toString()}
                          </span>
                          {rec.signed ? (
                            <Badge variant="success">Đã ký xác nhận</Badge>
                          ) : (
                            <Badge variant="warning">Chưa ký</Badge>
                          )}
                        </div>
                        <p className="text-sm text-stone-600">
                          Bác sĩ tạo: <strong>{displayName(rec.doctor)}</strong> • Ngày tạo:{" "}
                          {rec.createdAt.toLocaleString("vi-VN")}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!rec.signed && address?.toLowerCase() === rec.doctor.toLowerCase() && (
                          <Button
                            type="button"
                            variant="success"
                            disabled={busy}
                            onClick={() => void handleSignRecord(rec.id)}
                          >
                            Ký xác nhận
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void handleRequestAccess(rec.id)}
                        >
                          Yêu cầu quyền xem
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            setEmergencyTargetId(rec.id);
                            setEmergencyModalOpen(true);
                          }}
                        >
                          Truy cập khẩn cấp
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={!privateKey || busy}
                          onClick={() => void handleRetrieveAndView(rec.id)}
                        >
                          Giải mã & Xem bệnh án
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Màn hình xem chi tiết hồ sơ sau khi giải mã + 3 Badge toàn vẹn */}
          {retrievedData && (
            <Card
              title={`Chi tiết Bệnh án #${retrievedData.recordId.toString()} (Đã giải mã)`}
              subtitle={`Bác sĩ phụ trách: ${displayName(retrievedData.doctor)} • Tạo lúc: ${retrievedData.createdAt.toLocaleString("vi-VN")}`}
              action={
                <div className="flex flex-wrap gap-2">
                  <Badge variant={retrievedData.integrity.image ? "success" : "danger"}>
                    {retrievedData.integrity.image ? "✓ Ảnh toàn vẹn" : "✕ Ảnh sai lệch"}
                  </Badge>
                  <Badge variant={retrievedData.integrity.pdf ? "success" : "danger"}>
                    {retrievedData.integrity.pdf ? "✓ PDF toàn vẹn" : "✕ PDF sai lệch"}
                  </Badge>
                  <Badge variant={retrievedData.integrity.metadata ? "success" : "danger"}>
                    {retrievedData.integrity.metadata ? "✓ Chỉ số toàn vẹn" : "✕ Chỉ số sai lệch"}
                  </Badge>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Cột 1: Ảnh X-Quang */}
                <div className="lg:col-span-4 space-y-3">
                  <h3 className="text-lg font-bold text-stone-950">1. Hình ảnh Y tế (IPFS)</h3>
                  <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-950 aspect-square flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={retrievedData.imageUrl}
                      alt="Hình ảnh y tế đã giải mã"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Cột 2: File PDF Tóm tắt */}
                <div className="lg:col-span-4 space-y-3">
                  <h3 className="text-lg font-bold text-stone-950">2. Tóm tắt Bệnh án (PDF)</h3>
                  <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-100 aspect-square">
                    <iframe
                      src={retrievedData.pdfUrl}
                      title="Tóm tắt bệnh án PDF"
                      className="w-full h-full"
                    />
                  </div>
                  <a
                    href={retrievedData.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-base font-semibold text-teal-700 hover:underline"
                  >
                    Mở tệp PDF toàn màn hình ↗
                  </a>
                </div>

                {/* Cột 3: Chỉ số JSON giải mã */}
                <div className="lg:col-span-4 space-y-3">
                  <h3 className="text-lg font-bold text-stone-950">3. Chỉ số Nhân trắc (JSON)</h3>
                  <pre className="bg-stone-950 text-emerald-300 p-4 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed max-h-96">
                    {JSON.stringify(retrievedData.metadata, null, 2)}
                  </pre>
                  {selectedRecordId && (
                    <p className="text-sm text-stone-600">
                      Mã hồ sơ đang xem: <strong>#{selectedRecordId.toString()}</strong>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal Truy cập khẩn cấp */}
      {emergencyModalOpen && emergencyTargetId !== null && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <span className="text-2xl">🚨</span>
              <h2 className="text-xl font-extrabold">
                Xác nhận Truy cập Khẩn cấp Hồ sơ #{emergencyTargetId.toString()}
              </h2>
            </div>
            <p className="text-base text-stone-800 leading-relaxed">
              Hành động này sẽ mở quyền xem khẩn cấp trong <strong>24 giờ</strong> và ghi lý do công khai lên nhật ký kiểm toán. <strong>Lưu ý:</strong> Chỉ ghi lý do chuyên môn chung chung, tuyệt đối không ghi tên hoặc thông tin cá nhân của bệnh nhân.
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
                  placeholder="Ví dụ: Cấp cứu tại khoa hồi sức, cần tra cứu nhóm máu và tiền sử dị ứng..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-base focus:border-red-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setEmergencyModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="danger" disabled={busy}>
                  {busy ? "Đang gửi..." : "Xác nhận Truy cập Khẩn cấp"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}