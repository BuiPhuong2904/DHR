import Link from "next/link";

const routes = [
  { href: "/patient", title: "Patient Dashboard", desc: "Dành cho bệnh nhân" },
  { href: "/doctor", title: "Doctor Console", desc: "Dành cho bác sĩ" },
  { href: "/hospital", title: "Hospital Admin", desc: "Dành cho bệnh viện" },
  { href: "/verify", title: "Xác thực chứng nhận", desc: "Dành cho bảo hiểm / nhà tuyển dụng" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <h1 className="text-3xl font-bold">DHR - Hồ sơ sức khỏe điện tử</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {routes.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border-2 border-slate-900 p-5 hover:bg-slate-100"
          >
            <p className="text-xl font-semibold">{r.title}</p>
            <p className="mt-1 text-base">{r.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}