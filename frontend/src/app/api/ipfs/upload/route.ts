import { NextResponse } from "next/server";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: "Server thiếu PINATA_JWT" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File vượt quá 20 MB" }, { status: 413 });
  }

  const body = new FormData();
  body.append("file", file, file.name);
  body.append("network", "public");
  body.append("name", file.name);

  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  const json = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: json }, { status: res.status });
  }
  return NextResponse.json({
    cid: json.data.cid,
    name: json.data.name,
    size: json.data.size,
  });
}