// Original geometric phone/workbench icon. No DSH/DeepSeek trademark artwork.
// Dependency-free, reproducible PNG generation; safe content area for maskable icons.
import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([len, name, data, crc])
}
function png(size) {
  const bytes = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size; const py = y / size
    const frame = px > .29 && px < .71 && py > .20 && py < .80
    const inside = px > .33 && px < .67 && py > .25 && py < .71
    const line = px > .39 && px < .61 && py > .74 && py < .76
    const tiles = inside && ((px < .44 && py < .62) || (px > .48 && py < .40) || (px > .48 && py > .45 && py < .62))
    const rgb = line ? [255,255,255] : tiles ? [97, 223, 202] : inside ? [16,24,39] : frame ? [233,242,255] : [16,24,39]
    bytes.set(rgb, y * (size * 3 + 1) + 1 + x * 3)
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(bytes)), chunk('IEND', Buffer.alloc(0))])
}
await mkdir('assets', { recursive: true })
for (const [name, size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]]) {
  await writeFile(`assets/${name}`, png(size))
}
