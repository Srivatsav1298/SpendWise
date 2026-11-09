import { sniffType } from './uploads.module';

describe('upload type sniffing', () => {
  it('detects real types by magic bytes', () => {
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))?.mime).toBe('image/jpeg');
    expect(sniffType(Buffer.from('%PDF-1.7'))?.mime).toBe('application/pdf');
    expect(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe('image/png');
  });
  it('rejects scripts/html/executables regardless of claimed name', () => {
    expect(sniffType(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(sniffType(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(sniffType(Buffer.alloc(0))).toBeNull();
  });
});
