import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { time, loadFixture } = networkHelpers;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

// CID + mã băm giả lập cho 3 loại file (ảnh, PDF, metadata JSON)
function files(tag: string) {
  return {
    imageCid: `bafy-image-${tag}`,
    imageHash: ethers.id(`image-${tag}`),
    pdfCid: `bafy-pdf-${tag}`,
    pdfHash: ethers.id(`pdf-${tag}`),
    metadataCid: `bafy-meta-${tag}`,
    metadataHash: ethers.id(`meta-${tag}`),
  };
}

async function deployFixture() {
  const [admin, hospital, doctor1, doctor2, patient, guardian1, guardian2, stranger, newWallet] =
    await ethers.getSigners();

  const mr = await ethers.deployContract("MedicalRecord", [admin.address]);
  const HOSPITAL_ROLE = await mr.HOSPITAL_ROLE();
  const DOCTOR_ROLE = await mr.DOCTOR_ROLE();

  await mr.connect(admin).grantRole(HOSPITAL_ROLE, hospital.address);
  await mr.connect(hospital).grantRole(DOCTOR_ROLE, doctor1.address);
  await mr.connect(hospital).grantRole(DOCTOR_ROLE, doctor2.address);
  await mr.connect(patient).registerPublicKey("-----BEGIN PUBLIC KEY-----PATIENT-----END PUBLIC KEY-----");

  return { mr, admin, hospital, doctor1, doctor2, patient, guardian1, guardian2, stranger, newWallet, HOSPITAL_ROLE, DOCTOR_ROLE };
}

// Có sẵn 1 hồ sơ (id = 1) do doctor1 tạo cho patient
async function recordFixture() {
  const f = await deployFixture();
  await f.mr
    .connect(f.doctor1)
    .createRecord(f.patient.address, files("v1"), "wrapped-for-patient", "wrapped-for-hospital", 0);
  return f;
}

// Lấy cờ "emergency" trong event RecordAccessed của một giao dịch
async function accessedEmergencyFlag(mr: any, tx: any): Promise<boolean> {
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    const parsed = mr.interface.parseLog(log);
    if (parsed?.name === "RecordAccessed") return parsed.args.emergency;
  }
  throw new Error("Không thấy event RecordAccessed");
}

describe("MedicalRecord", function () {
  /* ------------------------------------------------------------------ */
  describe("Phân quyền RBAC", function () {
    it("Bệnh viện cấp được vai trò bác sĩ", async function () {
      const { mr, doctor1, DOCTOR_ROLE } = await loadFixture(deployFixture);
      expect(await mr.hasRole(DOCTOR_ROLE, doctor1.address)).to.equal(true);
    });

    it("Người lạ KHÔNG cấp được vai trò bác sĩ", async function () {
      const { mr, stranger, DOCTOR_ROLE } = await loadFixture(deployFixture);
      await expect(mr.connect(stranger).grantRole(DOCTOR_ROLE, stranger.address)).to.be.revertedWithCustomError(
        mr,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Người không phải bác sĩ KHÔNG tạo được hồ sơ", async function () {
      const { mr, stranger, patient } = await loadFixture(deployFixture);
      await expect(
        mr.connect(stranger).createRecord(patient.address, files("x"), "k", "e", 0),
      ).to.be.revertedWithCustomError(mr, "AccessControlUnauthorizedAccount");
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Nghiệp vụ 1 - Đăng ký hồ sơ", function () {
    it("Bác sĩ tạo hồ sơ thành công và phát event RecordCreated", async function () {
      const { mr, doctor1, patient } = await loadFixture(deployFixture);
      await expect(mr.connect(doctor1).createRecord(patient.address, files("v1"), "wk", "ek", 0))
        .to.emit(mr, "RecordCreated")
        .withArgs(1n, patient.address, doctor1.address, 0n);

      const r = await mr.getRecord(1);
      expect(r.patient).to.equal(patient.address);
      expect(r.doctor).to.equal(doctor1.address);
      expect(r.imageCid).to.equal("bafy-image-v1");
      expect(r.signed).to.equal(false);
      expect([...(await mr.getPatientRecords(patient.address))]).to.deep.equal([1n]);
    });

    it("Bệnh nhân chưa đăng ký public key thì không tạo được hồ sơ", async function () {
      const { mr, doctor1, stranger } = await loadFixture(deployFixture);
      await expect(mr.connect(doctor1).createRecord(stranger.address, files("x"), "wk", "ek", 0))
        .to.be.revertedWithCustomError(mr, "PublicKeyMissing")
        .withArgs(stranger.address);
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Ràng buộc 2 - Bất biến sau khi ký (notSigned)", function () {
    it("Sửa được khi CHƯA ký", async function () {
      const { mr, doctor1 } = await loadFixture(recordFixture);
      await expect(mr.connect(doctor1).updateRecord(1, files("v2"), "wk2", "ek2")).to.emit(mr, "RecordUpdated");
      expect((await mr.getRecord(1)).imageCid).to.equal("bafy-image-v2");
    });

    it("Sau khi ký thì KHÔNG sửa được nữa", async function () {
      const { mr, doctor1 } = await loadFixture(recordFixture);
      await expect(mr.connect(doctor1).signRecord(1)).to.emit(mr, "RecordSigned");
      await expect(mr.connect(doctor1).updateRecord(1, files("hack"), "wk", "ek"))
        .to.be.revertedWithCustomError(mr, "RecordAlreadySigned")
        .withArgs(1n);
    });

    it("Không ký lại được lần thứ hai", async function () {
      const { mr, doctor1 } = await loadFixture(recordFixture);
      await mr.connect(doctor1).signRecord(1);
      await expect(mr.connect(doctor1).signRecord(1)).to.be.revertedWithCustomError(mr, "RecordAlreadySigned");
    });

    it("Bác sĩ khác không sửa / ký được hồ sơ không phải của mình", async function () {
      const { mr, doctor2 } = await loadFixture(recordFixture);
      await expect(mr.connect(doctor2).updateRecord(1, files("v2"), "wk", "ek")).to.be.revertedWithCustomError(
        mr,
        "NotRecordDoctor",
      );
      await expect(mr.connect(doctor2).signRecord(1)).to.be.revertedWithCustomError(mr, "NotRecordDoctor");
    });

    it("Đính chính bằng bản mới trỏ về previousRecordId", async function () {
      const { mr, doctor1, patient } = await loadFixture(recordFixture);
      await mr.connect(doctor1).signRecord(1);
      await expect(mr.connect(doctor1).createRecord(patient.address, files("v2"), "wk", "ek", 1))
        .to.emit(mr, "RecordCreated")
        .withArgs(2n, patient.address, doctor1.address, 1n);
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Nghiệp vụ 3 - Xác thực toàn vẹn", function () {
    it("Hash đúng trả về true, hash sai trả về false", async function () {
      const { mr } = await loadFixture(recordFixture);
      expect(await mr.verifyFile(1, 0, ethers.id("image-v1"))).to.equal(true);
      expect(await mr.verifyFile(1, 1, ethers.id("pdf-v1"))).to.equal(true);
      expect(await mr.verifyFile(1, 2, ethers.id("meta-v1"))).to.equal(true);
      expect(await mr.verifyFile(1, 0, ethers.id("image-bi-sua"))).to.equal(false);
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Nghiệp vụ 2 - Cấp quyền + Ràng buộc 1 (onlyPatient) + Ràng buộc 3 (thời hạn)", function () {
    it("Bác sĩ gửi yêu cầu quyền xem", async function () {
      const { mr, doctor2, patient } = await loadFixture(recordFixture);
      await expect(mr.connect(doctor2).requestAccess(1))
        .to.emit(mr, "AccessRequested")
        .withArgs(1n, doctor2.address, patient.address);
    });

    it("Người không phải chủ hồ sơ KHÔNG cấp / thu hồi được quyền", async function () {
      const { mr, doctor1, doctor2, stranger } = await loadFixture(recordFixture);
      await expect(
        mr.connect(stranger).grantAccess(1, doctor2.address, "wk-d2", 7 * DAY),
      ).to.be.revertedWithCustomError(mr, "NotPatient");
      await expect(mr.connect(doctor1).revokeAccess(1, doctor2.address)).to.be.revertedWithCustomError(
        mr,
        "NotPatient",
      );
    });

    it("Không cấp quyền cho ví không phải bác sĩ", async function () {
      const { mr, patient, stranger } = await loadFixture(recordFixture);
      await expect(mr.connect(patient).grantAccess(1, stranger.address, "wk", 7 * DAY))
        .to.be.revertedWithCustomError(mr, "NotDoctor")
        .withArgs(stranger.address);
    });

    it("Thời hạn phải từ 1 giờ đến 30 ngày", async function () {
      const { mr, patient, doctor2 } = await loadFixture(recordFixture);
      await expect(mr.connect(patient).grantAccess(1, doctor2.address, "wk", 60)).to.be.revertedWithCustomError(
        mr,
        "InvalidDuration",
      );
      await expect(
        mr.connect(patient).grantAccess(1, doctor2.address, "wk", 31 * DAY),
      ).to.be.revertedWithCustomError(mr, "InvalidDuration");
    });

    it("Bác sĩ chưa được cấp quyền thì bị từ chối", async function () {
      const { mr, doctor2 } = await loadFixture(recordFixture);
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");
    });

    it("Được cấp quyền thì xem được và có nhật ký RecordAccessed", async function () {
      const { mr, patient, doctor2 } = await loadFixture(recordFixture);
      await expect(mr.connect(patient).grantAccess(1, doctor2.address, "wk-d2", 7 * DAY)).to.emit(
        mr,
        "AccessGranted",
      );
      expect(await mr.hasAccess(1, doctor2.address)).to.equal(true);
      expect([...(await mr.getGrantees(1))]).to.deep.equal([doctor2.address]);
      expect((await mr.getAccess(1, doctor2.address)).wrappedKey).to.equal("wk-d2");

      const tx = await mr.connect(doctor2).accessRecord(1);
      expect(await accessedEmergencyFlag(mr, tx)).to.equal(false);
    });

    it("Hết hạn thì tự động mất quyền", async function () {
      const { mr, patient, doctor2 } = await loadFixture(recordFixture);
      await mr.connect(patient).grantAccess(1, doctor2.address, "wk-d2", 7 * DAY);
      await time.increase(7 * DAY + 1);
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");
    });

    it("Bệnh nhân thu hồi thì bác sĩ mất quyền ngay", async function () {
      const { mr, patient, doctor2 } = await loadFixture(recordFixture);
      await mr.connect(patient).grantAccess(1, doctor2.address, "wk-d2", 7 * DAY);
      await expect(mr.connect(patient).revokeAccess(1, doctor2.address)).to.emit(mr, "AccessRevoked");
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");
    });

    it("Bác sĩ bị bệnh viện thu hồi vai trò thì mất quyền xem", async function () {
      const { mr, hospital, patient, doctor2, DOCTOR_ROLE } = await loadFixture(recordFixture);
      await mr.connect(patient).grantAccess(1, doctor2.address, "wk-d2", 7 * DAY);
      await mr.connect(hospital).revokeRole(DOCTOR_ROLE, doctor2.address);
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Mở rộng - Truy cập khẩn cấp (break-glass)", function () {
    it("Quy trình đầy đủ: mở khẩn cấp → bệnh viện giao khóa → xem (đánh dấu khẩn cấp) → hết 24 giờ", async function () {
      const { mr, hospital, doctor2 } = await loadFixture(recordFixture);

      await expect(mr.connect(doctor2).emergencyAccess(1, "Benh nhan bat tinh")).to.emit(mr, "EmergencyAccessed");
      // Chưa có khóa thì chưa xem được
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");

      await expect(mr.connect(hospital).deliverEmergencyKey(1, doctor2.address, "wk-emergency"))
        .to.emit(mr, "EmergencyKeyDelivered")
        .withArgs(1n, doctor2.address, hospital.address);

      const tx = await mr.connect(doctor2).accessRecord(1);
      expect(await accessedEmergencyFlag(mr, tx)).to.equal(true);

      await time.increase(DAY + 1);
      await expect(mr.connect(doctor2).accessRecord(1)).to.be.revertedWithCustomError(mr, "AccessDenied");
    });

    it("Chỉ bệnh viện được giao khóa khẩn cấp", async function () {
      const { mr, doctor1, doctor2 } = await loadFixture(recordFixture);
      await mr.connect(doctor2).emergencyAccess(1, "Cap cuu");
      await expect(
        mr.connect(doctor1).deliverEmergencyKey(1, doctor2.address, "wk"),
      ).to.be.revertedWithCustomError(mr, "AccessControlUnauthorizedAccount");
    });

    it("Không giao khóa khi không có yêu cầu khẩn cấp", async function () {
      const { mr, hospital, doctor2 } = await loadFixture(recordFixture);
      await expect(
        mr.connect(hospital).deliverEmergencyKey(1, doctor2.address, "wk"),
      ).to.be.revertedWithCustomError(mr, "NoActiveEmergency");
    });

    it("Người không phải bác sĩ không mở được truy cập khẩn cấp", async function () {
      const { mr, stranger } = await loadFixture(recordFixture);
      await expect(mr.connect(stranger).emergencyAccess(1, "x")).to.be.revertedWithCustomError(
        mr,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe("Xử lý mất private key - Social recovery", function () {
    it("Ngưỡng không hợp lệ bị từ chối", async function () {
      const { mr, patient, guardian1 } = await loadFixture(recordFixture);
      await expect(mr.connect(patient).setGuardians([guardian1.address], 2)).to.be.revertedWithCustomError(
        mr,
        "InvalidGuardians",
      );
    });

    it("Đủ 2/2 người giám hộ đồng ý thì chuyển toàn bộ hồ sơ sang ví mới", async function () {
      const { mr, hospital, patient, guardian1, guardian2, newWallet } = await loadFixture(recordFixture);
      await expect(mr.connect(patient).setGuardians([guardian1.address, guardian2.address], 2)).to.emit(
        mr,
        "GuardiansSet",
      );

      await mr.connect(guardian1).approveRecovery(patient.address, newWallet.address);
      expect((await mr.getRecord(1)).patient).to.equal(patient.address); // mới 1/2 phiếu

      await expect(mr.connect(guardian2).approveRecovery(patient.address, newWallet.address))
        .to.emit(mr, "PatientRecovered")
        .withArgs(patient.address, newWallet.address, 1n);

      expect((await mr.getRecord(1)).patient).to.equal(newWallet.address);
      expect([...(await mr.getPatientRecords(newWallet.address))]).to.deep.equal([1n]);
      expect([...(await mr.getPatientRecords(patient.address))]).to.deep.equal([]);

      // Bệnh viện bọc lại khóa AES cho ví mới từ bản escrow
      await expect(mr.connect(hospital).rewrapPatientKey(1, "wk-new-wallet")).to.emit(mr, "PatientKeyRewrapped");
      expect((await mr.getRecord(1)).patientWrappedKey).to.equal("wk-new-wallet");
    });

    it("Ví cũ mất quyền chủ sở hữu sau khi khôi phục", async function () {
      const { mr, patient, doctor2, guardian1, newWallet } = await loadFixture(recordFixture);
      await mr.connect(patient).setGuardians([guardian1.address], 1);
      await mr.connect(guardian1).approveRecovery(patient.address, newWallet.address);
      await expect(
        mr.connect(patient).grantAccess(1, doctor2.address, "wk", 7 * DAY),
      ).to.be.revertedWithCustomError(mr, "NotPatient");
    });

    it("Người không phải giám hộ không bỏ phiếu được, không bỏ phiếu 2 lần", async function () {
      const { mr, patient, guardian1, guardian2, stranger, newWallet } = await loadFixture(recordFixture);
      await mr.connect(patient).setGuardians([guardian1.address, guardian2.address], 2);
      await expect(
        mr.connect(stranger).approveRecovery(patient.address, newWallet.address),
      ).to.be.revertedWithCustomError(mr, "NotGuardian");
      await mr.connect(guardian1).approveRecovery(patient.address, newWallet.address);
      await expect(
        mr.connect(guardian1).approveRecovery(patient.address, newWallet.address),
      ).to.be.revertedWithCustomError(mr, "AlreadyVoted");
    });
  });
});
