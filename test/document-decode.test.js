// Owner: Chong Khen - Trivy Security and Quality Testing
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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

const docxFixture = path.join(__dirname, "fixtures", "study-notes.docx");

test("extracts real DOCX paragraphs and Unicode text", async () => {
  const document = await extractText(uploadedFile(
    "study-notes.docx", readFileSync(docxFixture),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ));
  assert.equal(document.text, "Study Butler document\n\n中文学习笔记");
  assert.equal(document.truncated, false);
});

test("applies the configured text limit to DOCX extraction", async () => {
  const previous = process.env.DOCUMENT_TEXT_LIMIT;
  process.env.DOCUMENT_TEXT_LIMIT = "12";
  try {
    const document = await extractText(uploadedFile("study-notes.docx", readFileSync(docxFixture)));
    assert.equal(document.text, "Study Butler");
    assert.equal(document.truncated, true);
  } finally {
    if (previous === undefined) delete process.env.DOCUMENT_TEXT_LIMIT;
    else process.env.DOCUMENT_TEXT_LIMIT = previous;
  }
});

test("rejects corrupt DOCX input", async () => {
  await assert.rejects(extractText(uploadedFile("broken.docx", Buffer.from("not a DOCX archive"))));
});

test("retains Mammoth CLI compatibility with the pinned argument parser", () => {
  const cli = path.join(path.dirname(require.resolve("mammoth/package.json")), "bin", "mammoth");
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--output-format/);
  const conversion = spawnSync(process.execPath, [cli, docxFixture, "--output-format", "markdown"], { encoding: "utf8" });
  assert.equal(conversion.status, 0, conversion.stderr);
  assert.match(conversion.stdout, /Study Butler document/);
  assert.match(conversion.stdout, /中文学习笔记/);
});
