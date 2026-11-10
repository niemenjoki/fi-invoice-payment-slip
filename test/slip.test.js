import assert from 'node:assert/strict';
import { test } from 'node:test';
import PDFDocument from 'pdfkit';

import { SLIP_HEIGHT, createPaymentSlipPdf, drawPaymentSlip, preparePaymentSlip } from '../src/index.js';

const DATA = {
  accounts: [
    { bank: 'Example Bank', iban: 'FI21 1234 5600 0007 85' },
    { bank: 'Other Bank', iban: 'FI55 4234 5670 0000 81' },
  ],
  bic: 'NDEAFIHH',
  recipient: { name: 'Example Oy', address: ['Esimerkkikatu 1', '00100 HELSINKI'] },
  payer: { name: 'Maija Maksaja', address: 'Viivatie 15\n09999 KOODILA' },
  amountCents: 11700,
  reference: '1234561',
  dueDate: '2026-11-30',
  info: ['Invoice 123456', 'Customer number 42'],
};

test('prepares the printed texts and codes', () => {
  const slip = preparePaymentSlip(DATA);
  assert.equal(slip.reference, '12 34561');
  assert.equal(slip.dueDate, '30.11.2026');
  assert.equal(slip.amount, '117,00');
  assert.deepEqual(slip.accounts.map((a) => a.ibanText), ['FI21 1234 5600 0007 85', 'FI55 4234 5670 0000 81']);
  assert.equal(slip.barcode, '421123456000007850001170000000000000000001234561261130');
  assert.ok(slip.qrPayload.startsWith('BCD\n001\n1\nSCT\nNDEAFIHH\nExample Oy\nFI2112345600000785\nEUR117.00\n'));
  assert.deepEqual(slip.recipient, ['Example Oy', 'Esimerkkikatu 1', '00100 HELSINKI']);
  assert.deepEqual(slip.payer, ['Maija Maksaja', 'Viivatie 15', '09999 KOODILA']);
});

test('large amounts are printed in groups, payer-chosen amount stays empty', () => {
  assert.equal(preparePaymentSlip({ ...DATA, amountCents: 123456789 }).amount, '1 234 567,89');
  const open = preparePaymentSlip({ ...DATA, amountCents: null });
  assert.equal(open.amount, '');
  assert.equal(open.barcode.slice(17, 25), '00000000');
});

test('no reference: message instead, no bar code', () => {
  const slip = preparePaymentSlip({ ...DATA, reference: '', message: 'For the theatre tickets' });
  assert.equal(slip.barcode, null);
  assert.equal(slip.message, 'For the theatre tickets');
  assert.ok(slip.qrPayload.endsWith('\nFor the theatre tickets\nReqdExctnDt/2026-11-30'));
});

test('RF reference with letters: QR only', () => {
  const slip = preparePaymentSlip({ ...DATA, reference: 'RF98REF1234' });
  assert.equal(slip.barcode, null);
  assert.equal(slip.reference, 'RF98 REF1 234');
});

test('codes can be switched off', () => {
  const slip = preparePaymentSlip({ ...DATA, barcode: false, qr: false });
  assert.equal(slip.barcode, null);
  assert.equal(slip.qrPayload, null);
});

test('input errors', () => {
  assert.throws(() => preparePaymentSlip({ ...DATA, accounts: undefined, iban: 'FI00' }), { code: 'invalid_iban' });
  assert.throws(() => preparePaymentSlip({ ...DATA, reference: '1234562' }), { code: 'invalid_reference' });
  assert.throws(() => preparePaymentSlip({ ...DATA, recipient: {} }), { code: 'missing_recipient' });
  assert.throws(() => preparePaymentSlip({ ...DATA, language: 'de' }), { code: 'invalid_language' });
  const five = Array.from({ length: 5 }, () => DATA.accounts[0]);
  assert.throws(() => preparePaymentSlip({ ...DATA, accounts: five }), { code: 'invalid_iban' });
});

test('creates a PDF in both languages', async () => {
  for (const language of ['fi-sv', 'en']) {
    const pdf = await createPaymentSlipPdf({ ...DATA, language });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 2000);
  }
});

test('draws into an existing document at a given position', async () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.text('Invoice content');
  const slip = drawPaymentSlip(doc, DATA, { y: doc.page.height - SLIP_HEIGHT });
  doc.end();
  assert.equal(slip.reference, '12 34561');
});

test('rejects a broken input as a promise rejection', async () => {
  await assert.rejects(createPaymentSlipPdf({ ...DATA, iban: undefined, accounts: [{ iban: 'x' }] }), { code: 'invalid_iban' });
});
