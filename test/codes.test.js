import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CODE128_PATTERNS,
  createFinnishReference,
  createQrPayload,
  createRfReference,
  createVirtualBarcode,
  encodeCode128C,
  formatIban,
  formatReference,
  isValidFinnishReference,
  isValidIban,
  isValidRfReference,
  parseReference,
} from '../src/index.js';
import { QR_EXAMPLE_1, VERSION_4, VERSION_5 } from './finance-finland-examples.js';

test('Finnish reference: Finance Finland examples', () => {
  assert.equal(createFinnishReference('123456'), '1234561');
  assert.equal(createFinnishReference('999'), '9991');
  assert.equal(createFinnishReference('000123456'), '1234561');
  for (const { reference } of VERSION_4) assert.ok(isValidFinnishReference(reference), reference);
  assert.equal(isValidFinnishReference('1234562'), false);
  assert.equal(isValidFinnishReference('123'), false);
  assert.throws(() => createFinnishReference('12'), { code: 'invalid_reference' });
  assert.throws(() => createFinnishReference('1'.repeat(20)), { code: 'invalid_reference' });
});

test('RF reference: Finance Finland examples', () => {
  assert.equal(createRfReference('9991'), 'RF049991');
  assert.equal(createRfReference('1234'), 'RF541234');
  assert.equal(createRfReference('REF1234'), 'RF98REF1234');
  assert.ok(isValidRfReference('RF07 6633 2132 8510'));
  for (const { reference } of VERSION_5) assert.ok(isValidRfReference(reference), reference);
  // The RF references in the guide are built from the Finnish references of the version 4 invoices,
  // except invoice 3, which was replaced in the 2019 correction.
  VERSION_5.forEach((v5, i) => {
    if (i !== 2) assert.equal(createRfReference(parseReference(VERSION_4[i].reference).value), parseReference(v5.reference).value);
  });
  assert.equal(isValidRfReference('RF05 9991'), false);
  assert.throws(() => createRfReference('A'.repeat(22)), { code: 'invalid_reference' });
});

test('reference paper format', () => {
  assert.equal(formatReference('1234561'), '12 34561');
  assert.equal(formatReference('00000000000001234561'), '12 34561');
  assert.equal(formatReference('8685162596 19897'), '86851 62596 19897');
  assert.equal(formatReference('rf07663321328510'), 'RF07 6633 2132 8510');
  assert.equal(formatReference('RF98REF1234'), 'RF98 REF1 234');
  assert.throws(() => formatReference('1234562'), { code: 'invalid_reference' });
});

test('IBAN', () => {
  assert.ok(isValidIban('FI21 1234 5600 0007 85'));
  assert.ok(isValidIban('DE89370400440532013000'));
  assert.equal(isValidIban('FI21 1234 5600 0007 86'), false);
  assert.equal(formatIban('fi2112345600000785'), 'FI21 1234 5600 0007 85');
});

test('Code 128 pattern table is consistent', () => {
  assert.equal(CODE128_PATTERNS.length, 107);
  CODE128_PATTERNS.forEach((pattern, value) => {
    const widths = [...pattern].map(Number);
    const bars = widths.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    const spaces = widths.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
    assert.equal(bars + spaces, value === 106 ? 13 : 11, `module count of ${value}`);
    assert.equal(bars % 2, 0, `bar modules of ${value} must be even`);
  });
  assert.equal(new Set(CODE128_PATTERNS).size, 107);
});

for (const [version, examples] of [['4', VERSION_4], ['5', VERSION_5]]) {
  examples.forEach((example, i) => {
    test(`bank bar code version ${version}, test invoice ${i + 1}`, () => {
      const digits = createVirtualBarcode(example);
      assert.equal(digits, example.pairs.replace(/ /g, ''));
      const { values, check } = encodeCode128C(digits);
      assert.equal(check, example.check);
      assert.deepEqual(values, [105, ...example.pairs.split(' ').map(Number), example.check, 106]);
    });
  });
}

test('bank bar code edge cases', () => {
  const base = { iban: 'FI2112345600000785', reference: '1234561', dueDate: '2026-12-31' };
  assert.equal(createVirtualBarcode({ ...base, amountCents: 100_000_000 }).slice(17, 25), '00000000');
  assert.equal(createVirtualBarcode({ ...base, amountCents: null }).slice(17, 25), '00000000');
  assert.equal(createVirtualBarcode({ ...base, dueDate: new Date(Date.UTC(2026, 11, 31)) }).slice(-6), '261231');
  assert.throws(() => createVirtualBarcode({ ...base, iban: 'DE89370400440532013000' }), { code: 'barcode_not_possible' });
  assert.throws(() => createVirtualBarcode({ ...base, reference: 'RF98REF1234' }), { code: 'barcode_not_possible' });
  assert.throws(() => createVirtualBarcode({ ...base, reference: '' }), { code: 'invalid_reference' });
  assert.throws(() => createVirtualBarcode({ ...base, dueDate: '2026-02-30' }), { code: 'invalid_due_date' });
  assert.throws(() => createVirtualBarcode({ ...base, amountCents: 1.5 }), { code: 'invalid_amount' });
});

test('QR payload: Finance Finland example 1', () => {
  assert.equal(createQrPayload(QR_EXAMPLE_1.input), QR_EXAMPLE_1.payload);
});

test('QR payload variants', () => {
  const base = { recipientName: 'Example Oy', iban: 'FI21 1234 5600 0007 85' };
  assert.equal(createQrPayload({ ...base, bic: 'NDEAFIHH', reference: '12 34561' }),
    'BCD\n001\n1\nSCT\nNDEAFIHH\nExample Oy\nFI2112345600000785\n\n\n1234561');
  assert.equal(createQrPayload({ ...base, amountCents: 5000, message: 'For the theatre tickets' }),
    'BCD\n002\n1\nSCT\n\nExample Oy\nFI2112345600000785\nEUR50.00\n\n\nFor the theatre tickets');
  // A reference wins over a message, as on the credit transfer form.
  assert.ok(!createQrPayload({ ...base, reference: '1234561', message: 'zzz' }).includes('zzz'));
  assert.throws(() => createQrPayload({ ...base, recipientName: 'x'.repeat(71) }), { code: 'qr_field_too_long' });
  assert.throws(() => createQrPayload({ ...base, bic: 'NDEA' }), { code: 'invalid_bic' });
  assert.throws(() => createQrPayload({ ...base, recipientName: '' }), { code: 'missing_recipient' });
});
