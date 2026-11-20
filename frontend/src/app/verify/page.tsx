"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { INITIAL_SBTS, MOCK_WALLETS } from "@/mock/dhrData";

export default function VerifyPage() {
  const [walletInput, setWalletInput] = useState(MOCK_WALLETS.patient);
  const [certType, setCertType] = useState("HEALTH_CHECK_OK");
  const [result, setResult] = useState<null | { valid: boolean; checkedWallet: string; checkedType: string }>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = INITIAL_SBTS.some(
      (sbt) =>
        sbt.patient.toLowerCase() === walletInput.trim().toLowerCase() &&
        sbt.certType === certType &&
        sbt.valid
    );
    setResult({
      valid: matched,
      checkedWallet: walletInput.trim(),
      checkedType: certType,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-2">
        <Badge variant="info">PUBLIC VERIFIER • SOULBOUND NFT</Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 pt-1">
          Cổng Xác thực Chứng nhận Y tế
        </h1>
        <p className="text-base text-stone-700 max-w-2xl mx-auto">
          Dành cho đơn vị bảo hiểm và nhà tuyển dụng kiểm tra tính hợp lệ của chứng nhận sức khỏe mà không cần truy cập dữ liệu bệnh án chi tiết.
        </p>
      </div>

      <Card title="Tra cứu Chứng nhận Sức khỏe">
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block font-bold text-stone-900 mb-1.5">
              Địa chỉ ví Bệnh nhân cần kiểm tra *
            </label>
            <input
              type="text"
              required
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-base text-stone-950 focus:border-teal-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-900 mb-1.5">
              Loại chứng nhận *
            </label>
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-base font-semibold text-stone-950 focus:border-teal-600 focus:outline-none"
            >
              <option value="HEALTH_CHECK_OK">Chứng nhận Đủ sức khỏe Lao động / Học tập</option>
              <option value="VACCINATION_HEPB">Chứng nhận Tiêm chủng Viêm gan B</option>
              <option value="TREATMENT_COMPLETED">Chứng nhận Hoàn thành Điều trị</option>
            </select>
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full">
            Kiểm tra Chứng nhận
          </Button>
        </form>

        {/* Kết quả trả về CÓ / KHÔNG */}
        {result && (
          <div
            className={`mt-6 p-6 rounded-2xl border-2 text-center space-y-2 ${
              result.valid
                ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                : "bg-red-50 border-red-500 text-red-950"
            }`}
          >
            <span className="text-sm font-bold uppercase tracking-wider block">
              KẾT QUẢ XÁC THỰC CHỨNG NHẬN
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold">
              {result.valid ? "CÓ — CHỨNG NHẬN HỢP LỆ" : "KHÔNG — KHÔNG TÌM THẤY CHỨNG NHẬN"}
            </div>
            <p className="text-base pt-1">
              Ví: <span className="font-mono font-semibold">{result.checkedWallet}</span> • Loại:{" "}
              <strong>{result.checkedType}</strong>
            </p>
            <p className="text-sm opacity-80">
              (Bảo mật quyền riêng tư: Không hiển thị hồ sơ bệnh án hay chỉ số y khoa nhạy cảm)
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}