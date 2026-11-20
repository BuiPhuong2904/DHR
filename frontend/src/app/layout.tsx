import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { KeyProvider } from "@/context/KeyContext";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "AegisHealth DHR — Hệ thống Hồ sơ Sức khỏe Điện tử Phi tập trung",
  description: "Quản lý hồ sơ bệnh án bảo mật đầu cuối trên Ethereum Sepolia & IPFS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-stone-50 text-stone-900 text-base antialiased min-h-screen flex flex-col`}>
        <WalletProvider>
          <KeyProvider>
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-stone-200 bg-white py-6 mt-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-base text-stone-600">
                <span>© 2026 AegisHealth DHR • Mạng thử nghiệm Ethereum Sepolia</span>
                <span className="font-medium text-stone-800">Mã hóa đầu cuối trên chuỗi khối & IPFS</span>
              </div>
            </footer>
          </KeyProvider>
        </WalletProvider>
      </body>
    </html>
  );
}