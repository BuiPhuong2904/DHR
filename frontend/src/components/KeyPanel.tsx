"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWallet } from "@/context/WalletContext";
import { useKeys } from "@/context/KeyContext";
import {
  generateRsaKeyPair,
  exportPublicKeyPem,
  backupPrivateKey,
} from "@/lib/crypto";
import { hasPublicKey, registerPublicKeyFlow } from "@/lib/dhr";
import { EXPLORER_TX } from "@/lib/web3";

export function KeyPanel() {
  const { address } = useWallet();
  return <KeyPanelInner key={address ?? "no-wallet"} />;
}

function KeyPanelInner() {
  const { address, signer } = useWallet();
  const { privateKey, setSessionKey, loadFromBackup, clear } = useKeys();

  const [registeredOnChain, setRegisteredOnChain] = useState<boolean>(false);
  const [newPublicKey, setNewPublicKey] = useState<CryptoKey | null>(null);
  const [publicKeyPem, setPublicKeyPem] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Sao lưu khóa
  const [backupPassword, setBackupPassword] = useState("");

  // Nạp khóa từ file sao lưu
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Thông báo & link Etherscan
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!signer || !address) return;
    let active = true;
    hasPublicKey(signer, address)
      .then((ok) => {
        if (active) setRegisteredOnChain(ok);
      })
      .catch(() => {
        if (active) setRegisteredOnChain(false);
      });
    return () => {
      active = false;
    };
  }, [signer, address]);

  const handleGenerate = async () => {
    if (
      registeredOnChain &&
      !window.confirm(
        "Ví này ĐÃ đăng ký khóa trên chuỗi. Nếu tạo khóa mới và đăng ký lại, các hồ sơ cũ sẽ KHÔNG giải mã được nữa.\n\nThông thường bạn chỉ cần NẠP KHÓA TỪ TỆP SAO LƯU (cột 3). Vẫn muốn tạo khóa mới?"
      )
    ) {
      return;
    }
    setErrorMsg(null);
    setMessage(null);
    setGenerating(true);
    try {
      const kp = await generateRsaKeyPair();
      const pem = await exportPublicKeyPem(kp.publicKey);
      setNewPublicKey(kp.publicKey);
      setPublicKeyPem(pem);
      setSessionKey(kp.privateKey);
      setMessage("Đã tạo cặp khóa RSA-2048 mới! Hãy đăng ký khóa công khai lên chuỗi khối và tải tệp sao lưu.");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegisterOnChain = async () => {
    if (!signer || !newPublicKey) return;
    setErrorMsg(null);
    setMessage(null);
    setTxHash(null);
    setRegistering(true);
    try {
      await registerPublicKeyFlow(signer, newPublicKey, (status, hash) => {
        if (hash) setTxHash(hash);
        if (status !== "confirmed") setMessage("Đang chờ xác nhận giao dịch đăng ký khóa trên Sepolia...");
      });
      setRegisteredOnChain(true);
      setMessage("Đã đăng ký khóa công khai lên chuỗi khối thành công!");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRegistering(false);
    }
  };

  const handleDownloadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateKey || !backupPassword) return;
    setErrorMsg(null);
    try {
      const backupObj = await backupPrivateKey(privateKey, backupPassword);
      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhr-key-backup-${address ? address.slice(0, 8) : "wallet"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupPassword("");
      setMessage("Đã mã hóa khóa bí mật và tải xuống tệp sao lưu thành công!");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestoreFromFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile || !restorePassword) return;
    setErrorMsg(null);
    setMessage(null);
    setRestoring(true);
    try {
      await loadFromBackup(backupFile, restorePassword);
      setRestorePassword("");
      setMessage("Đã nạp khóa bí mật vào phiên làm việc thành công!");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Card
      title="Quản lý Khóa Bảo mật RSA"
      subtitle="Cần có khóa bí mật trong phiên làm việc để mã hóa, cấp quyền hoặc giải mã bệnh án"
      action={
        <div className="flex flex-wrap gap-2">
          {registeredOnChain ? (
            <Badge variant="success">Đã đăng ký khóa trên chuỗi</Badge>
          ) : (
            <Badge variant="warning">Chưa đăng ký khóa trên chuỗi</Badge>
          )}
          {privateKey ? (
            <Badge variant="success">Đã nạp khóa phiên</Badge>
          ) : (
            <Badge variant="danger">Thiếu khóa phiên</Badge>
          )}
        </div>
      }
    >
      {errorMsg && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-400 text-red-900 font-semibold text-base">
          ✕ {errorMsg}
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-400 text-emerald-950 font-semibold text-base flex flex-wrap items-center justify-between gap-2">
          <span>✓ {message}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột 1: Tạo khóa mới & Đăng ký lên Blockchain */}
        <div className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
          <h3 className="text-lg font-extrabold text-stone-950">1. Tạo & Đăng ký Khóa Mới</h3>
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="primary" onClick={handleGenerate} disabled={generating || !address}>
              {generating ? "Đang tạo..." : "Tạo cặp khóa RSA"}
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={handleRegisterOnChain}
              disabled={!signer || !newPublicKey || registering}
            >
              {registering ? "Đang gửi..." : "Đăng ký khóa lên chuỗi"}
            </Button>
          </div>
          <textarea
            readOnly
            rows={4}
            value={publicKeyPem || "Khóa công khai sẽ hiển thị tại đây sau khi tạo..."}
            className="w-full p-3 rounded-xl border border-stone-300 bg-white font-mono text-sm text-stone-800 focus:outline-none"
          />
        </div>

        {/* Cột 2: Sao lưu khóa hiện tại ra file JSON */}
        <form onSubmit={handleDownloadBackup} className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
          <h3 className="text-lg font-extrabold text-stone-950">2. Tải Tệp Sao lưu Khóa</h3>
          <p className="text-sm text-stone-700">
            Mã hóa khóa bí mật hiện tại bằng mật khẩu cá nhân để lưu trữ an toàn trên máy.
          </p>
          <input
            type="password"
            required
            minLength={6}
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="Đặt mật khẩu sao lưu (>= 6 ký tự)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-base focus:border-teal-600 focus:outline-none"
          />
          <Button type="submit" variant="secondary" disabled={!privateKey} className="w-full">
            Tải tệp sao lưu (.json)
          </Button>
        </form>

        {/* Cột 3: Nạp khóa từ file sao lưu */}
        <form onSubmit={handleRestoreFromFile} className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-stone-950">3. Nạp Khóa từ Tệp Sao lưu</h3>
            {privateKey && (
              <button
                type="button"
                onClick={clear}
                className="text-sm font-semibold text-red-700 hover:underline cursor-pointer"
              >
                Xóa khóa phiên
              </button>
            )}
          </div>
          <input
            type="file"
            accept=".json,application/json"
            required
            onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
            className="block w-full text-base text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-semibold file:bg-teal-700 file:text-white cursor-pointer"
          />
          <input
            type="password"
            required
            value={restorePassword}
            onChange={(e) => setRestorePassword(e.target.value)}
            placeholder="Nhập mật khẩu giải mã tệp"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-base focus:border-teal-600 focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={!backupFile || restoring} className="w-full">
            {restoring ? "Đang giải mã..." : "Nạp khóa vào phiên"}
          </Button>
        </form>
      </div>
    </Card>
  );
}