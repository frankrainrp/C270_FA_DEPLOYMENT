const path = require("path");

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml",
  ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx",
  ".jsx", ".py", ".java", ".c", ".cpp", ".h", ".hpp", ".sql",
  ".yaml", ".yml", ".toml", ".ini", ".log",
]);

const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ".pdf", ".docx"]);
const DEFAULT_TEXT_LIMIT = 60000;

function getTextLimit() {
  const configured = Number(process.env.DOCUMENT_TEXT_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_LIMIT;
}

function decodePlainText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = Buffer.from(buffer.subarray(2));
    for (let i = 0; i + 1 < body.length; i += 2) {
      const first = body[i];
      body[i] = body[i + 1];
      body[i + 1] = first;
    }
    return body.toString("utf16le");
  }
  const withoutBom = buffer.length >= 3
    && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
    ? buffer.subarray(3)
    : buffer;
  return withoutBom.toString("utf8");
}

async function extractText(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported document type: ${extension || "unknown"}.`);
  }

  let text;
  if (TEXT_EXTENSIONS.has(extension)) {
    text = decodePlainText(file.buffer);
  } else if (extension === ".pdf") {
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(file.buffer);
    text = result.text || "";
  } else {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = result.value || "";
  }

  text = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    throw new Error("No readable text was found in this document.");
  }

  const limit = getTextLimit();
  const truncated = text.length > limit;
  return {
    name: path.basename(file.originalname),
    mimeType: file.mimetype || "application/octet-stream",
    size: file.size,
    text: truncated ? text.slice(0, limit) : text,
    truncated,
  };
}

module.exports = { extractText, SUPPORTED_EXTENSIONS };
