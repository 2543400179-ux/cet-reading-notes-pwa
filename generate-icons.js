import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 2; // Color type: 2 (Truecolor RGB)
  ihdrData[10] = 0; // Compression: 0
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data: filter byte (0) + width * 3 bytes per scanline
  const rowBytes = 1 + width * 3;
  const rawData = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    rawData[rowStart] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;
      // Gradient / soft circle styling
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = width * 0.45;
      
      let pr = r;
      let pg = g;
      let pb = b;
      
      if (dist < maxR) {
        // Inner ocean highlight
        const ratio = 1 - dist / maxR;
        pr = Math.min(255, Math.floor(r + ratio * 60));
        pg = Math.min(255, Math.floor(g + ratio * 80));
        pb = Math.min(255, Math.floor(b + ratio * 100));
      }
      rawData[idx] = pr;
      rawData[idx + 1] = pg;
      rawData[idx + 2] = pb;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 44, 64, 86));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 44, 64, 86));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 44, 64, 86));
console.log('Icons generated successfully!');
