"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWallet } from "@/context/WalletContext";
import { hasValidCertificate } from "@/lib/dhr";
import { getProvider } from "@/lib/web3";
import { CERT_LABELS } from "@/lib/directory";

export default function VerifyPage() {
  const { signer } = useWallet();

  const [walletInput, setWalletInput] = useState("0x1E3d9eA7c2a1e9eA970e3a0691147Ec7990A5CE5");
  const [certType, setCertType] = useState("HEALTH_CHECK_OK");
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<null | { valid: boolean; checkedWallet: string; checkedType: string }>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletInput.trim()) return;

    setErrorMsg(null);
    setResult(null);
    setChecking(true);
    try {
      const runner = signer ?? getProvider();
      const valid = await hasValidCertificate(runner, walletInput.trim(), certType);
      setResult({
        valid,
        checkedWallet: walletInput.trim(),
        checkedType: certType,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-2">
        <Badge variant="info">CỔNG KIỂM TRA CÔNG KHAI</Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 pt-1">
          Cổng Xác thực Chứng nhận Y tế
        </h1>
        <p className="text-base text-stone-700 max-w-2xl mx-auto">
          Dành cho đơn vị bảo hiểm và nhà tuyển dụng kiểm tra tính hợp lệ của chứng nhận sức khỏe mà không cần truy cập dữ liệu bệnh án chi tiết.
        </p>
      </div>

      <Card title="Tra cứu Chứng nhận Sức khỏe">
        {errorMsg && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-400 text-red-900 font-semibold text-base">
            ✕ {errorMsg}
          </div>
        )}

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
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-base text-stone-950 focus:border-teal-600 focus:outline-none"
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
              <option value="HEALTH_CHECK_OK">{CERT_LABELS.HEALTH_CHECK_OK}</option>
              <option value="VACCINATION_HEPB">{CERT_LABELS.VACCINATION_HEPB}</option>
              <option value="TREATMENT_COMPLETED">{CERT_LABELS.TREATMENT_COMPLETED}</option>
            </select>
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={checking} className="w-full">
            {checking ? "Đang kiểm tra trên Sepolia..." : "Kiểm tra Chứng nhận"}
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
              <strong>{CERT_LABELS[result.checkedType] || result.checkedType}</strong>
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