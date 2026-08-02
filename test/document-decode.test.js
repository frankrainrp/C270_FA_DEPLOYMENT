// Owner: Chong Khen - Trivy Security and Quality Testing
const test = require("node:test");
const assert = require("node:assert/strict");

const { extractText } = require("../src/services/DocumentDecodeService");

function uploadedFile(name, buffer, mimeType = "text/plain") {
  return {
    originalname: name,
    buffer,
    mimetype: mimeType,
    size: buffer.length,
  };
}

test("extracts UTF-8 text documents", async () => {
  const document = await extractText(uploadedFile("notes.md", Buffer.from("# Revision\nMongoDB", "utf8")));
  assert.equal(document.name, "notes.md");
  assert.match(document.text, /MongoDB/);
  assert.equal(document.truncated, false);
});

test("detects and extracts UTF-16LE text documents", async () => {
  const body = Buffer.from("Study plan", "utf16le");
  const document = await extractText(uploadedFile("plan.txt", Buffer.concat([Buffer.from([0xff, 0xfe]), body])));
  assert.equal(document.text, "Study plan");
});

test("rejects unsupported binary file types", async () => {
  await assert.rejects(
    extractText(uploadedFile("archive.zip", Buffer.from([0x50, 0x4b]), "application/zip")),
    /Unsupported document type/,
  );
});
