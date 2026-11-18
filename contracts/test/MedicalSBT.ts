import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { time, loadFixture } = networkHelpers;

const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [admin, hospital, patient, insurer, stranger] = await ethers.getSigners();
  const sbt = await ethers.deployContract("MedicalSBT", [admin.address]);
  await sbt.connect(admin).grantRole(await sbt.HOSPITAL_ROLE(), hospital.address);
  return { sbt, admin, hospital, patient, insurer, stranger };
}

// Có sẵn chứng nhận tokenId = 1 "HEALTH_CHECK_OK" hạn 365 ngày cho patient
async function mintedFixture() {
  const f = await deployFixture();
  const expiresAt = (await time.latest()) + 365 * DAY;
  await f.sbt.connect(f.hospital).mint(f.patient.address, "HEALTH_CHECK_OK", expiresAt, "ipfs://bafy-cert-1");
  return f;
}

describe("MedicalSBT", function () {
  describe("Nghiệp vụ 1 - Cấp chứng nhận (mint)", function () {
    it("Bệnh viện mint thành công, token khóa vĩnh viễn (ERC-5192)", async function () {
      const { sbt, hospital, patient } = await loadFixture(deployFixture);
      const expiresAt = (await time.latest()) + 365 * DAY;
      await expect(sbt.connect(hospital).mint(patient.address, "HEALTH_CHECK_OK", expiresAt, "ipfs://bafy-cert-1"))
        .to.emit(sbt, "Locked")
        .withArgs(1n);

      expect(await sbt.ownerOf(1)).to.equal(patient.address);
      expect(await sbt.locked(1)).to.equal(true);
      expect(await sbt.tokenURI(1)).to.equal("ipfs://bafy-cert-1");
      expect(await sbt.supportsInterface("0xb45a3c0e")).to.equal(true);
    });

    it("Người không phải bệnh viện KHÔNG mint được", async function () {
      const { sbt, stranger, patient } = await loadFixture(deployFixture);
      await expect(
        sbt.connect(stranger).mint(patient.address, "HEALTH_CHECK_OK", 0, "ipfs://x"),
      ).to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");
    });

    it("Không mint chứng nhận đã hết hạn", async function () {
      const { sbt, hospital, patient } = await loadFixture(deployFixture);
      const past = (await time.latest()) - 1;
      await expect(
        sbt.connect(hospital).mint(patient.address, "HEALTH_CHECK_OK", past, "ipfs://x"),
      ).to.be.revertedWithCustomError(sbt, "InvalidExpiry");
    });
  });

  describe("Soulbound - không thể chuyển nhượng", function () {
    it("transferFrom bị chặn", async function () {
      const { sbt, patient, stranger } = await loadFixture(mintedFixture);
      await expect(
        sbt.connect(patient).transferFrom(patient.address, stranger.address, 1),
      ).to.be.revertedWithCustomError(sbt, "Soulbound");
    });

    it("safeTransferFrom bị chặn", async function () {
      const { sbt, patient, stranger } = await loadFixture(mintedFixture);
      await expect(
        sbt.connect(patient)["safeTransferFrom(address,address,uint256)"](patient.address, stranger.address, 1),
      ).to.be.revertedWithCustomError(sbt, "Soulbound");
    });

    it("approve và setApprovalForAll bị chặn", async function () {
      const { sbt, patient, stranger } = await loadFixture(mintedFixture);
      await expect(sbt.connect(patient).approve(stranger.address, 1)).to.be.revertedWithCustomError(sbt, "Soulbound");
      await expect(sbt.connect(patient).setApprovalForAll(stranger.address, true)).to.be.revertedWithCustomError(
        sbt,
        "Soulbound",
      );
    });
  });

  describe("Nghiệp vụ 2 - Xác thực (validate)", function () {
    it("Bảo hiểm kiểm tra được: có chứng nhận đúng loại → true, loại khác → false", async function () {
      const { sbt, patient, insurer } = await loadFixture(mintedFixture);
      expect(await sbt.connect(insurer).hasValidCertificate(patient.address, "HEALTH_CHECK_OK")).to.equal(true);
      expect(await sbt.connect(insurer).hasValidCertificate(patient.address, "VACCINATION_HEPB")).to.equal(false);
      expect(await sbt.connect(insurer).hasValidCertificate(insurer.address, "HEALTH_CHECK_OK")).to.equal(false);
    });

    it("Hết hạn thì xác thực trả về false", async function () {
      const { sbt, patient } = await loadFixture(mintedFixture);
      await time.increase(365 * DAY + 1);
      expect(await sbt.hasValidCertificate(patient.address, "HEALTH_CHECK_OK")).to.equal(false);
    });
  });

  describe("Nghiệp vụ 3 - Thu hồi (revoke)", function () {
    it("Bệnh viện thu hồi thì xác thực trả về false", async function () {
      const { sbt, hospital, patient } = await loadFixture(mintedFixture);
      await expect(sbt.connect(hospital).revoke(1))
        .to.emit(sbt, "CertificateRevoked")
        .withArgs(1n, patient.address);
      expect(await sbt.hasValidCertificate(patient.address, "HEALTH_CHECK_OK")).to.equal(false);
    });

    it("Người không phải bệnh viện không thu hồi được", async function () {
      const { sbt, patient } = await loadFixture(mintedFixture);
      await expect(sbt.connect(patient).revoke(1)).to.be.revertedWithCustomError(
        sbt,
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
