// Owner: HeinThuNyiNyi - Automated Testing
const test = require("node:test");
const assert = require("node:assert/strict");

const { hasExpectedImageSignature } = require("../src/routes/api/profile");

test("avatar validation accepts the declared supported image signatures", () => {
  assert.equal(hasExpectedImageSignature(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "image/png"
  ), true);
  assert.equal(hasExpectedImageSignature(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), true);
  assert.equal(hasExpectedImageSignature(Buffer.from("GIF89a", "ascii"), "image/gif"), true);
  assert.equal(hasExpectedImageSignature(Buffer.from("RIFF0000WEBP", "ascii"), "image/webp"), true);
});

test("avatar validation rejects MIME spoofing and unsupported content", () => {
  assert.equal(hasExpectedImageSignature(Buffer.from("not an image"), "image/png"), false);
  assert.equal(hasExpectedImageSignature(Buffer.from([0xff, 0xd8, 0xff]), "image/png"), false);
  assert.equal(hasExpectedImageSignature(Buffer.from("<svg></svg>"), "image/svg+xml"), false);
});
