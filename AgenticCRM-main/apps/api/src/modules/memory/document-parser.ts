import { inflateRawSync, inflateSync } from 'node:zlib';

const MAX_TEXT_CHARS = 2_000_000;

function decodeXml(value: string): string {
  return value
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)));
}

function extractDocx(buffer: Buffer): string {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Invalid DOCX archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLen);
    if (name === 'word/document.xml') {
      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const packed = buffer.subarray(start, start + compressedSize);
      const xml = method === 0 ? packed : method === 8 ? inflateRawSync(packed) : null;
      if (!xml) throw new Error('Unsupported DOCX compression method');
      return decodeXml(xml.toString('utf8'));
    }
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('DOCX does not contain word/document.xml');
}

function pdfLiteral(raw: string): string {
  return raw.replace(/\\([nrtbf()\\])/g, (_m, c) => ({
    n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\',
  } as Record<string, string>)[c] ?? c).replace(/\\([0-7]{1,3})/g, (_m, oct) =>
    String.fromCharCode(parseInt(oct, 8)));
}

function extractPdf(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const streams: string[] = [];
  const streamRe = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw))) {
    const bytes = Buffer.from(match[2], 'latin1');
    let decoded = bytes;
    if (/\/FlateDecode/.test(match[1])) {
      try { decoded = inflateSync(bytes); } catch { try { decoded = inflateRawSync(bytes); } catch { continue; } }
    }
    streams.push(decoded.toString('latin1'));
  }
  const content = streams.join('\n');
  const output: string[] = [];
  const textBlocks = content.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of textBlocks) {
    const tokenRe = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:.|\n)*?)\]\s*TJ/g;
    let token: RegExpExecArray | null;
    while ((token = tokenRe.exec(block))) {
      if (token[1] !== undefined) output.push(pdfLiteral(token[1]));
      else {
        const parts = token[2].match(/\(((?:\\.|[^\\)])*)\)/g) ?? [];
        output.push(parts.map((p) => pdfLiteral(p.slice(1, -1))).join(''));
      }
    }
  }
  return output.join(' ').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export function extractDocumentText(fileName: string, mimeType: string, buffer: Buffer): string {
  if (!buffer.length) throw new Error('The uploaded file is empty');
  if (buffer.length > 15 * 1024 * 1024) throw new Error('Maximum upload size is 15 MB');
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  let text: string;
  if (ext === 'pdf' || mimeType === 'application/pdf') text = extractPdf(buffer);
  else if (ext === 'docx' || mimeType.includes('wordprocessingml')) text = extractDocx(buffer);
  else if (['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml'].includes(ext) ||
           mimeType.startsWith('text/') || mimeType === 'application/json') {
    text = buffer.toString('utf8');
    if (ext === 'html' || ext === 'htm' || ext === 'xml') text = decodeXml(text);
  } else {
    throw new Error('Supported formats: PDF, DOCX, TXT, MD, CSV, JSON, HTML and XML');
  }
  text = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('No extractable text found. Scanned PDFs require OCR before upload.');
  return text.slice(0, MAX_TEXT_CHARS);
}
