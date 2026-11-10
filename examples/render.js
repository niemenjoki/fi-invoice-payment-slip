// Writes example PDFs to examples/out/ for visual checks and for scanning with a bank app.
import { mkdirSync, writeFileSync } from 'node:fs';

import { createPaymentSlipPdf } from '../src/index.js';

const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });

const company = {
  accounts: [
    { bank: 'Example Bank', iban: 'FI21 1234 5600 0007 85' },
    { bank: 'Other Bank', iban: 'FI55 4234 5670 0000 81' },
  ],
  bic: 'NDEAFIHH',
  recipient: { name: 'Oy Yritys Ab', address: ['Yrityskuja 12, 4. krs', '12345 Kaupunki'] },
  payer: { name: 'Maija Maksaja', address: ['Viivatie 15', '09999 Koodila'] },
  info: ['Invoice number 123456', 'Customer number 42'],
};

const examples = {
  'finnish-reference': { ...company, amountCents: 11700, reference: '12 34561', dueDate: '2026-11-30' },
  'rf-reference-en': { ...company, language: 'en', amountCents: 15824, reference: 'RF07 6633 2132 8510', dueDate: '2026-12-22' },
  'message-no-reference': {
    ...company,
    accounts: [{ iban: 'FI90 3636 3001 0100 24' }],
    bic: undefined,
    amountCents: 5000,
    message: 'For the theatre tickets',
    dueDate: '2026-11-30',
  },
};

for (const [name, data] of Object.entries(examples)) {
  writeFileSync(new URL(`${name}.pdf`, out), await createPaymentSlipPdf(data));
  console.log(`examples/out/${name}.pdf`);
}
