"use client";

import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import {
  INITIAL_RECORDS,
  INITIAL_ACCESS_LOGS,
  INITIAL_SBTS,
  MOCK_WALLETS,
} from "@/mock/dhrData";

const PORTAL_CARDS = [
  {
    roleTag: "BÁC SĨ CHUYÊN KHOA",
    title: "Cổng Bác sĩ & Chẩn đoán",
    href: "/doctor",
    desc: "Tải lên ảnh X-quang, tóm tắt PDF và chỉ số nhân trắc JSON; ký xác nhận bất biến hoặc kích hoạt truy cập khẩn cấp.",
    actionText: "Mở không gian Bác sĩ",
    icon: (
      <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    roleTag: "CHỦ SỞ HỮU HỒ SƠ",
    title: "Trung tâm Sức khỏe Bệnh nhân",
    href: "/patient",
    desc: "Khởi tạo & sao lưu khóa RSA, đối chiếu toàn vẹn SHA-256, cấp hoặc thu hồi quyền xem hồ sơ và chỉ định người giám hộ.",
    actionText: "Quản lý hồ sơ cá nhân",
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    roleTag: "CƠ SỞ Y TẾ",
    title: "Điều hành Cơ sở Y tế",
    href: "/hospital",
    desc: "Cấp quyền hành nghề cho bác sĩ trên Smart Contract, phát hành chứng nhận Soulbound NFT và giao khóa cấp cứu.",
    actionText: "Vào cổng Bệnh viện",
    icon: (
      <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    roleTag: "ĐƠN VỊ XÁC THỰC",
    title: "Cổng Xác thực Chứng nhận SBT",
    href: "/verify",
    desc: "Xác minh tình trạng sức khỏe qua Soulbound Token dành cho bảo hiểm và nhà tuyển dụng mà không lộ bệnh án.",
    actionText: "Kiểm tra chứng nhận",
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { address } = useWallet();

  const roleLabel =
    address === MOCK_WALLETS.doctor1
      ? "Bác sĩ Chuyên khoa"
      : address === MOCK_WALLETS.hospital
      ? "Quản trị Bệnh viện"
      : address
      ? "Bệnh nhân • Chủ sở hữu Hồ sơ"
      : "Chưa kết nối ví";

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-linear-to-br from-stone-950 via-teal-950 to-stone-900 text-white p-5 sm:p-8 lg:p-11 shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-teal-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-cyan-200 text-sm sm:text-base font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Hạ tầng Y tế Phi tập trung • Bảo mật Dữ liệu Cá nhân</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.2]">
              Hồ sơ Sức khỏe Điện tử Thế hệ mới trên Blockchain
            </h1>

            <p className="text-base sm:text-lg text-stone-200 leading-relaxed">
              Trao trả toàn quyền kiểm soát bệnh án cho bệnh nhân. Mọi dữ liệu hình ảnh, xét nghiệm và chỉ số sinh trắc được mã hóa đầu cuối trước khi lưu phân tán trên IPFS.
            </p>

            <div className="pt-1 flex flex-col sm:flex-row gap-3">
              <Link
                href="/patient"
                className="text-center px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-base shadow-lg shadow-teal-600/30 transition-all"
              >
                Mở Hồ sơ của tôi →
              </Link>
              <Link
                href="/doctor"
                className="text-center px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-base transition-all"
              >
                Cổng Bác sĩ
              </Link>
            </div>
          </div>

          {/* HỘ CHIẾU SỨC KHỎE SỐ Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-linear-to-br from-white/15 to-white/5 backdrop-blur-xl border border-white/20 p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold block">
                    HỘ CHIẾU SỨC KHỎE SỐ
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white mt-0.5 block">
                    {roleLabel}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-bold">
                  {address ? "ĐÃ XÁC THỰC" : "CHẾ ĐỘ KHÁCH"}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-sm text-stone-300">Mã định danh y tế</span>
                <p className="font-mono text-base text-white bg-stone-950/50 px-3.5 py-2.5 rounded-xl border border-white/10 truncate">
                  {address || "Vui lòng bấm Kết nối ví ở góc trên"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-stone-950/45 rounded-xl p-3.5 border border-white/10 flex sm:block items-center justify-between">
                  <span className="text-xl sm:text-2xl font-extrabold text-white block">
                    {INITIAL_RECORDS.length}
                  </span>
                  <span className="text-sm text-stone-300">Bệnh án IPFS</span>
                </div>
                <div className="bg-stone-950/45 rounded-xl p-3.5 border border-white/10 flex sm:block items-center justify-between">
                  <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 block">
                    {INITIAL_SBTS.length}
                  </span>
                  <span className="text-sm text-stone-300">Chứng chỉ SBT</span>
                </div>
                <div className="bg-stone-950/45 rounded-xl p-3.5 border border-white/10 flex sm:block items-center justify-between">
                  <span className="text-xl sm:text-2xl font-extrabold text-cyan-300 block">
                    RSA-2048
                  </span>
                  <span className="text-sm text-stone-300">Khóa bảo mật</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Cổng nghiệp vụ chính */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-stone-950 tracking-tight">
            Không gian Làm việc theo Vai trò
          </h2>
          <p className="text-base text-stone-600 mt-1">
            Phân quyền chặt chẽ qua OpenZeppelin AccessControl trên hợp đồng thông minh
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {PORTAL_CARDS.map((card) => (
            <div
              key={card.href}
              className="group bg-white border border-stone-200/90 hover:border-teal-500/60 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 group-hover:bg-teal-50 flex items-center justify-center transition-colors">
                    {card.icon}
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-800 font-mono text-sm font-bold">
                    {card.roleTag}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-stone-950 mb-2.5 group-hover:text-teal-700 transition-colors">
                  {card.title}
                </h3>
                <p className="text-base text-stone-700 leading-relaxed mb-6">
                  {card.desc}
                </p>
              </div>

              <Link
                href={card.href}
                className="inline-flex items-center justify-between w-full px-5 py-3.5 rounded-xl bg-stone-100 group-hover:bg-teal-600 text-stone-950 group-hover:text-white font-semibold text-base transition-all"
              >
                <span>{card.actionText}</span>
                <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Dòng sự kiện On-Chain gần đây */}
      <section className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-950">
              Nhật ký Truy cập Hồ sơ Gần đây
            </h2>
            <p className="text-base text-stone-600 mt-1">
              Lịch sử truy cập được ghi nhận minh bạch và không thể chỉnh sửa trên hệ thống
            </p>
          </div>
          <Link
            href="/patient"
            className="text-base font-semibold text-teal-700 hover:text-teal-800"
          >
            Xem toàn bộ lịch sử →
          </Link>
        </div>

        <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
          {INITIAL_ACCESS_LOGS.map((log) => (
            <div
              key={log.logId}
              className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                log.emergency ? "bg-red-50/80" : "bg-white"
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-sm font-bold ${
                      log.emergency
                        ? "bg-red-600 text-white"
                        : "bg-teal-100 text-teal-900"
                    }`}
                  >
                    {log.emergency ? "Truy cập khẩn cấp" : "Truy cập thông thường"}
                  </span>
                  <span className="font-bold text-stone-950 text-base">
                    Hồ sơ #{log.recordId} — {log.accessorName}
                  </span>
                </div>
                {log.reason && (
                  <p className="text-base text-red-900 font-medium">
                    Lý do khẩn cấp: {log.reason}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="font-mono text-sm text-stone-600 block">
                  {log.accessor.slice(0, 8)}...{log.accessor.slice(-6)}
                </span>
                <span className="text-base text-stone-800 font-medium">
                  {log.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}