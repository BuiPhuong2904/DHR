"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { MOCK_WALLETS } from "@/mock/dhrData";

const NAV_ITEMS = [
  { href: "/", label: "Tổng quan" },
  { href: "/doctor", label: "Bác sĩ" },
  { href: "/patient", label: "Bệnh nhân" },
  { href: "/hospital", label: "Bệnh viện" },
  { href: "/verify", label: "Xác thực SBT" },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/90 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 shrink-0 group"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-linear-to-tr from-teal-700 via-teal-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold text-stone-950 tracking-tight">
                Aegis<span className="text-teal-600">Health</span>
              </span>
            </div>
            <span className="text-sm text-stone-500 font-medium hidden sm:block">
              Hồ sơ Sức khỏe Số Bảo mật
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/80">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 lg:px-4 py-2 rounded-xl text-base font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-white text-teal-700 shadow-sm ring-1 ring-stone-200/80"
                    : "text-stone-700 hover:text-stone-950 hover:bg-white/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop & Tablet Wallet Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-sm font-semibold whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            Sepolia
          </div>

          {address ? (
            <>
              <select
                aria-label="Chuyển đổi vai trò ví"
                value={address}
                onChange={(e) => connect(e.target.value)}
                className="hidden lg:block bg-white border border-stone-300 hover:border-blue-400 text-stone-900 text-base font-semibold rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer transition-colors"
              >
                <option value={MOCK_WALLETS.patient}>Bệnh nhân</option>
                <option value={MOCK_WALLETS.doctor1}>Bác sĩ</option>
                <option value={MOCK_WALLETS.hospital}>Bệnh viện</option>
              </select>

              <button
                type="button"
                onClick={handleCopy}
                title="Bấm để sao chép địa chỉ ví"
                className="flex items-center gap-2 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 px-3 sm:px-3.5 py-2 rounded-xl font-mono text-base font-semibold whitespace-nowrap transition-colors cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{copied ? "Đã chép!" : shortAddr}</span>
              </button>

              <button
                type="button"
                onClick={disconnect}
                className="hidden sm:inline-flex px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-stone-800 font-semibold text-base whitespace-nowrap transition-colors cursor-pointer"
              >
                Ngắt ví
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => connect()}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base whitespace-nowrap shadow-sm shadow-teal-600/20 transition-all cursor-pointer"
            >
              Kết nối ví
            </button>
          )}

          {/* Nút Hamburger mở menu trên Mobile (< md) */}
          <button
            type="button"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-900 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-stone-200 px-4 pt-3 pb-5 space-y-4 shadow-lg">
          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                    active
                      ? "bg-blue-50 text-teal-700 border border-blue-200"
                      : "text-stone-800 hover:bg-stone-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {address && (
            <div className="pt-3 border-t border-stone-200 space-y-3">
              <label className="block text-base font-semibold text-stone-700">
                Chuyển đổi vai trò ví demo:
                <select
                  value={address}
                  onChange={(e) => {
                    connect(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  className="mt-1.5 w-full bg-stone-50 border border-stone-300 text-stone-900 text-base font-semibold rounded-xl px-3.5 py-2.5"
                >
                  <option value={MOCK_WALLETS.patient}>Ví Bệnh nhân</option>
                  <option value={MOCK_WALLETS.doctor1}>Ví Bác sĩ</option>
                  <option value={MOCK_WALLETS.hospital}>Ví Bệnh viện</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  disconnect();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 rounded-xl border border-red-300 bg-red-50 text-red-700 font-semibold text-base"
              >
                Ngắt kết nối ví
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}