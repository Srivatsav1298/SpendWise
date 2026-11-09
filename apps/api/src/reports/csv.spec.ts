import { toCsv } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'he said "hi"']])).toBe('a,b\r\n"x,y","he said ""hi"""\r\n');
  });
  it('neutralises spreadsheet formula injection but keeps negative numbers', () => {
    const out = toCsv(['m'], [['=HYPERLINK("http://evil")'], ['-12.50'], ['@SUM(A1)'], ['+cmd']]);
    expect(out).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(out).toContain('\r\n-12.50\r\n');
    expect(out).toContain("'@SUM(A1)");
    expect(out).toContain("'+cmd");
  });
});
