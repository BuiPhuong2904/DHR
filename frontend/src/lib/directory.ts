type Entry = { name: string; org?: string };

const DIRECTORY: Record<string, Entry> = {
  "0xfe185c1fa620699fe6eaaa001828cafa37668498": { name: "Bệnh viện DHR", org: "BV Đa khoa DHR" },
  "0xff2dfd48c2506ed60a6317171425fec95a3d51e4": { name: "BS. CKII Trần Minh Quân", org: "BV Đa khoa DHR" },
  "0xff90d71e01f8c302552a55e4c72f649992f2e5ed": { name: "BS. Lê Hoàng Nam", org: "Khoa Nội tổng hợp" },
  "0x1e3d9ea7c2a1e9ea970e3a0691147ec7990a5ce5": { name: "Bệnh nhân" },
  "0x2125b085aab175ce5e63bface4acdb4b77ecbbbc": { name: "Công ty Bảo hiểm DHR", org: "Đơn vị xác thực" },
};

export const shortAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

export function displayName(address: string): string {
  return DIRECTORY[address.toLowerCase()]?.name ?? shortAddress(address);
}

export function displayOrg(address: string): string {
  return DIRECTORY[address.toLowerCase()]?.org ?? "";
}

export const CERT_LABELS: Record<string, string> = {
  HEALTH_CHECK_OK: "Chứng nhận đủ sức khỏe lao động & học tập",
  VACCINATION_HEPB: "Chứng nhận tiêm chủng viêm gan B",
  TREATMENT_COMPLETED: "Chứng nhận hoàn thành điều trị",
};

export const RECORD_TYPE_LABELS: Record<string, string> = {
  GENERAL_CHECKUP: "Khám tổng quát",
  XRAY: "Chụp X-quang",
  ULTRASOUND: "Siêu âm",
  LAB_TEST: "Xét nghiệm",
  VACCINATION: "Tiêm chủng",
};

/** "1 giờ" | "24 giờ" | "7 ngày" | "30 ngày" -> số ngày (dùng cho grantAccessFlow) */
export function durationToDays(label: string): number {
  const n = parseFloat(label);
  return label.includes("giờ") ? n / 24 : n;
}