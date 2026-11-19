export interface Anthropometrics {
  heightCm: number;
  weightKg: number;
  bmi?: number;
  waistCm?: number;
  bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRateBpm?: number;
}

export interface DhrMetadata {
  schemaVersion: "1.0.0";
  patientId: string;
  doctorId?: string;
  facilityId?: string;
  recordType: "GENERAL_CHECKUP" | "XRAY" | "ULTRASOUND" | "LAB_TEST" | "VACCINATION";
  examDate: string;
  sex?: "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED";
  birthYear?: number;
  anthropometrics: Anthropometrics;
}

export interface MedicalRecordItem {
  id: number;
  patient: string;
  doctor: string;
  doctorName: string;
  facilityName: string;
  imageCid: string;
  imageHash: string;
  imageUrl: string;
  pdfCid: string;
  pdfHash: string;
  pdfUrl: string;
  metadataCid: string;
  metadataHash: string;
  signed: boolean;
  createdAt: string;
  previousRecordId: number;
  metadata: DhrMetadata;
}

export interface AccessRequestItem {
  requestId: string;
  recordId: number;
  doctorAddress: string;
  doctorName: string;
  hospitalName: string;
  requestedAt: string;
  note: string;
}

export interface AuthorizedDoctorItem {
  recordId: number;
  doctorAddress: string;
  doctorName: string;
  hospitalName: string;
  expiresAt: string;
  remainingText: string;
  emergency: boolean;
}

export interface AccessLogItem {
  logId: string;
  recordId: number;
  accessor: string;
  accessorName: string;
  timestamp: string;
  emergency: boolean;
  reason?: string;
}

export interface SbtCertificateItem {
  tokenId: number;
  patient: string;
  certType: string;
  certLabel: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  valid: boolean;
}

export const MOCK_WALLETS = {
  patient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  doctor1: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  doctor2: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  hospital: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};

export const INITIAL_RECORDS: MedicalRecordItem[] = [
  {
    id: 1,
    patient: MOCK_WALLETS.patient,
    doctor: MOCK_WALLETS.doctor1,
    doctorName: "BS. CKII Trần Minh Quân",
    facilityName: "BV Đa khoa Quốc tế Sài Gòn",
    imageCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    imageHash: "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    imageUrl: "/mock/xquang-mau.png",
    pdfCid: "bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3ezlo3rs754256235a",
    pdfHash: "0x4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    pdfUrl: "/mock/tom-tat-benh-an-mau.pdf",
    metadataCid: "bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq",
    metadataHash: "0xef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
    signed: true,
    createdAt: "2026-11-10 09:30",
    previousRecordId: 0,
    metadata: {
      schemaVersion: "1.0.0",
      patientId: MOCK_WALLETS.patient,
      doctorId: MOCK_WALLETS.doctor1,
      facilityId: MOCK_WALLETS.hospital,
      recordType: "XRAY",
      examDate: "2026-11-10",
      sex: "FEMALE",
      birthYear: 2005,
      anthropometrics: {
        heightCm: 170,
        weightKg: 65,
        bmi: 22.5,
        waistCm: 72,
        bloodType: "O+",
        bloodPressure: { systolic: 115, diastolic: 75 },
        heartRateBpm: 74,
      },
    },
  },
  {
    id: 2,
    patient: MOCK_WALLETS.patient,
    doctor: MOCK_WALLETS.doctor1,
    doctorName: "BS. CKII Trần Minh Quân",
    facilityName: "BV Đa khoa Quốc tế Sài Gòn",
    imageCid: "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
    imageHash: "0x7902699be42c8a8e46fbbb4501726517e86b22c56a189f7625a6da49081b2451",
    imageUrl: "/mock/xquang-mau.png",
    pdfCid: "bafybeid2624323424324234234234234234234234234234234234234234a",
    pdfHash: "0x2c624232cdd221771294dfbb310aca000a0df6ac8b66b696d90ef06fdefb64a3",
    pdfUrl: "/mock/tom-tat-benh-an-mau.pdf",
    metadataCid: "bafybeih89023423423423423423423423423423423423423423423423423b",
    metadataHash: "0x19581e27de7ced00ff1ce50b2047e7a567c76b1cbaebabe5ef03f7c3017bb5b7",
    signed: false,
    createdAt: "2026-11-18 14:15",
    previousRecordId: 1,
    metadata: {
      schemaVersion: "1.0.0",
      patientId: MOCK_WALLETS.patient,
      doctorId: MOCK_WALLETS.doctor1,
      facilityId: MOCK_WALLETS.hospital,
      recordType: "GENERAL_CHECKUP",
      examDate: "2026-11-18",
      sex: "FEMALE",
      birthYear: 2005,
      anthropometrics: {
        heightCm: 170,
        weightKg: 64.5,
        bmi: 22.3,
        waistCm: 71,
        bloodType: "O+",
        bloodPressure: { systolic: 118, diastolic: 76 },
        heartRateBpm: 72,
      },
    },
  },
];

export const INITIAL_PENDING_REQUESTS: AccessRequestItem[] = [
  {
    requestId: "REQ-01",
    recordId: 1,
    doctorAddress: MOCK_WALLETS.doctor2,
    doctorName: "BS. Lê Hoàng Nam (Khoa Nội tổng hợp)",
    hospitalName: "BV Chợ Rẫy",
    requestedAt: "2026-11-19 08:45",
    note: "Xin xem kết quả X-quang phổi cũ để đối chiếu trước phẫu thuật",
  },
  {
    requestId: "REQ-02",
    recordId: 2,
    doctorAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    doctorName: "BS. Nguyễn Thu Hà (Khoa Tim mạch)",
    hospitalName: "BV Đại học Y Dược",
    requestedAt: "2026-11-19 10:12",
    note: "Kiểm tra chỉ số huyết áp và nhịp tim định kỳ",
  },
];

export const INITIAL_AUTHORIZED_DOCTORS: AuthorizedDoctorItem[] = [
  {
    recordId: 1,
    doctorAddress: MOCK_WALLETS.doctor1,
    doctorName: "BS. CKII Trần Minh Quân",
    hospitalName: "BV Đa khoa Quốc tế Sài Gòn",
    expiresAt: "2026-12-10 09:30",
    remainingText: "20 ngày 20 giờ",
    emergency: false,
  },
  {
    recordId: 1,
    doctorAddress: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    doctorName: "BS. Phạm Quốc Bảo",
    hospitalName: "Phòng khám Đa khoa Hoàn Mỹ",
    expiresAt: "2026-11-22 18:00",
    remainingText: "3 ngày 5 giờ",
    emergency: false,
  },
];

export const INITIAL_ACCESS_LOGS: AccessLogItem[] = [
  {
    logId: "LOG-101",
    recordId: 1,
    accessor: MOCK_WALLETS.doctor1,
    accessorName: "BS. CKII Trần Minh Quân",
    timestamp: "2026-11-10 10:05:12",
    emergency: false,
  },
  {
    logId: "LOG-102",
    recordId: 1,
    accessor: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    accessorName: "BS. Trực Cấp Cứu - Đặng Văn Hùng",
    timestamp: "2026-11-15 23:41:09",
    emergency: true,
    reason: "Bệnh nhân ngất xỉu tại phòng cấp cứu, cần tra cứu nhóm máu & tiền sử dị ứng gấp",
  },
  {
    logId: "LOG-103",
    recordId: 1,
    accessor: MOCK_WALLETS.patient,
    accessorName: "Bệnh nhân (Chủ hồ sơ)",
    timestamp: "2026-11-18 19:20:44",
    emergency: false,
  },
];

export const INITIAL_SBTS: SbtCertificateItem[] = [
  {
    tokenId: 1001,
    patient: MOCK_WALLETS.patient,
    certType: "HEALTH_CHECK_OK",
    certLabel: "Chứng nhận Đủ sức khỏe Lao động & Học tập",
    issuedBy: "BV Đa khoa Quốc tế Sài Gòn",
    issuedAt: "2026-11-10",
    expiresAt: "2027-11-10",
    valid: true,
  },
  {
    tokenId: 1002,
    patient: MOCK_WALLETS.patient,
    certType: "VACCINATION_HEPB",
    certLabel: "Chứng nhận Tiêm chủng Viêm gan B (Đủ 3 mũi)",
    issuedBy: "Trung tâm Tiêm chủng VNVC",
    issuedAt: "2026-06-15",
    expiresAt: "2036-06-15",
    valid: true,
  },
];