import struct, zlib, os

def create_png(width, height, r, g, b):
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += bytes([r, g, b])

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
resources = os.path.join(base, 'resources')

# Blue #42A5F5
png16 = create_png(16, 16, 66, 165, 245)
with open(os.path.join(resources, 'tray-icon.png'), 'wb') as f:
    f.write(png16)

png256 = create_png(256, 256, 66, 165, 245)
with open(os.path.join(resources, 'icon.png'), 'wb') as f:
    f.write(png256)

print('Icons created successfully')
