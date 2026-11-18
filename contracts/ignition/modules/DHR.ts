import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { id } from "ethers";

const HOSPITAL_ROLE = id("HOSPITAL_ROLE");
const DOCTOR_ROLE = id("DOCTOR_ROLE");
const VERIFIER_ROLE = id("VERIFIER_ROLE");

export default buildModule("DHRModule", (m) => {
  // Ví deploy (Admin-BenhVien) = quản trị + bệnh viện
  const admin = m.getAccount(0);

  // Địa chỉ ví test
  const doctor1 = m.getParameter("doctor1", "0xfF2DFd48C2506ed60A6317171425fec95a3D51e4"); // BacSi-1
  const doctor2 = m.getParameter("doctor2", "0xFF90d71e01F8c302552A55e4c72F649992F2E5ed"); // BacSi-2
  const verifier = m.getParameter("verifier", "0x2125b085aab175Ce5e63BfacE4acDB4b77eCBBbC"); // BaoHiem

  const medicalRecord = m.contract("MedicalRecord", [admin]);
  const medicalSBT = m.contract("MedicalSBT", [admin]);

  // MedicalRecord: Admin làm bệnh viện, bệnh viện cấp vai trò bác sĩ
  const mrHospital = m.call(medicalRecord, "grantRole", [HOSPITAL_ROLE, admin], { id: "MR_grantHospital" });
  m.call(medicalRecord, "grantRole", [DOCTOR_ROLE, doctor1], { id: "MR_grantDoctor1", after: [mrHospital] });
  m.call(medicalRecord, "grantRole", [DOCTOR_ROLE, doctor2], { id: "MR_grantDoctor2", after: [mrHospital] });
  m.call(medicalRecord, "grantRole", [VERIFIER_ROLE, verifier], { id: "MR_grantVerifier" });

  // MedicalSBT: Admin làm bệnh viện để mint chứng nhận
  m.call(medicalSBT, "grantRole", [HOSPITAL_ROLE, admin], { id: "SBT_grantHospital" });

  return { medicalRecord, medicalSBT };
});