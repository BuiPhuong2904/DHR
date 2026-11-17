import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gateway = process.env.PINATA_GATEWAY;
  if (!gateway) {
    return NextResponse.json({ error: "Server thiếu PINATA_GATEWAY" }, { status: 500 });
  }

  const cid = new URL(req.url).searchParams.get("cid") ?? "";
  // CID chỉ gồm chữ và số, chặn chuỗi lạ để tránh bị lợi dụng
  if (!/^[a-zA-Z0-9]{20,100}$/.test(cid)) {
    return NextResponse.json({ error: "CID không hợp lệ" }, { status: 400 });
  }

  const res = await fetch(`https://${gateway}/ipfs/${cid}`);
  if (!res.ok) {
    return NextResponse.json({ error: "Không tải được file từ IPFS" }, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}