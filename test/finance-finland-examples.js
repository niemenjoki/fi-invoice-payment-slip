// Test invoices from Finance Finland's Bank Bar Code Guide v5.3, sections 13.1 and 13.2 (corrected 21.10.2019).
// `pairs` is the symbol row printed in the guide without START (105), check and STOP; `check` is the
// printed check character. Amounts are in cents.

export const VERSION_4 = [
  { iban: 'FI79 4405 2020 0360 82', amountCents: 488315, reference: '86851 62596 19897', dueDate: '2010-06-12',
    pairs: '47 94 40 52 02 00 36 08 20 04 88 31 50 00 00 00 08 68 51 62 59 61 98 97 10 06 12', check: 40 },
  { iban: 'FI58 1017 1000 0001 22', amountCents: 48299, reference: '55958 22432 94671', dueDate: '2012-01-31',
    pairs: '45 81 01 71 00 00 00 12 20 00 48 29 90 00 00 00 05 59 58 22 43 29 46 71 12 01 31', check: 55 },
  { iban: 'FI02 5000 4640 0013 02', amountCents: 69380, reference: '69 87567 20834 35364', dueDate: '2011-07-24',
    pairs: '40 25 00 04 64 00 01 30 20 00 69 38 00 00 00 06 98 75 67 20 83 43 53 64 11 07 24', check: 14 },
  { iban: 'FI15 6601 0001 5306 41', amountCents: 744454, reference: '7 75847 47906 47489', dueDate: '2019-12-19',
    pairs: '41 56 60 10 00 15 30 64 10 07 44 45 40 00 00 00 77 58 47 47 90 64 74 89 19 12 19', check: 63 },
  { iban: 'FI16 8000 1400 0502 67', amountCents: 93585, reference: '78 77767 96566 28687', dueDate: null,
    pairs: '41 68 00 01 40 00 50 26 70 00 93 58 50 00 00 07 87 77 67 96 56 62 86 87 00 00 00', check: 30 },
  { iban: 'FI73 3131 3001 0000 58', amountCents: 0, reference: '8 68624', dueDate: '2013-08-09',
    pairs: '47 33 13 13 00 10 00 05 80 00 00 00 00 00 00 00 00 00 00 00 00 86 86 24 13 08 09', check: 68 },
  { iban: 'FI83 3301 0001 1007 75', amountCents: 15000020, reference: '92125 37425 25398 97737', dueDate: '2016-05-25',
    pairs: '48 33 30 10 00 11 00 77 51 50 00 02 00 00 92 12 53 74 25 25 39 89 77 37 16 05 25', check: 45 },
  { iban: 'FI39 3636 3002 0924 92', amountCents: 103, reference: '5907 38390', dueDate: '2023-03-11',
    pairs: '43 93 63 63 00 20 92 49 20 00 00 10 30 00 00 00 00 00 00 05 90 73 83 90 23 03 11', check: 9 },
  { iban: 'FI92 3939 0001 0033 91', amountCents: 2, reference: '13 57914', dueDate: '2099-12-24',
    pairs: '49 23 93 90 00 10 03 39 10 00 00 00 20 00 00 00 00 00 00 00 01 35 79 14 99 12 24', check: 30 },
];

export const VERSION_5 = [
  { iban: 'FI79 4405 2020 0360 82', amountCents: 488315, reference: 'RF09 8685 1625 9619 897', dueDate: '2010-06-12',
    pairs: '57 94 40 52 02 00 36 08 20 04 88 31 50 90 00 00 08 68 51 62 59 61 98 97 10 06 12', check: 74 },
  { iban: 'FI58 1017 1000 0001 22', amountCents: 48299, reference: 'RF06 5595 8224 3294 671', dueDate: '2010-01-31',
    pairs: '55 81 01 71 00 00 00 12 20 00 48 29 90 60 00 00 05 59 58 22 43 29 46 71 10 01 31', check: 31 },
  { iban: 'FI02 5000 4640 0013 02', amountCents: 69380, reference: 'RF61 6987 5672 0839', dueDate: '2011-07-24',
    // Erratum: the guide prints check 59, but Modulus 103 over the printed pairs (the guide's own algorithm)
    // gives 34. The pairs match the RF reference, so the printed check is from the uncorrected example.
    pairs: '50 25 00 04 64 00 01 30 20 00 69 38 06 10 00 00 00 00 69 87 56 72 08 39 11 07 24', check: 34 },
  { iban: 'FI15 6601 0001 5306 41', amountCents: 744454, reference: 'RF84 7758 4747 9064 7489', dueDate: '2019-12-19',
    pairs: '51 56 60 10 00 15 30 64 10 07 44 45 48 40 00 00 77 58 47 47 90 64 74 89 19 12 19', check: 16 },
  { iban: 'FI16 8000 1400 0502 67', amountCents: 93585, reference: 'RF60 7877 7679 6566 2868 7', dueDate: null,
    pairs: '51 68 00 01 40 00 50 26 70 00 93 58 56 00 00 07 87 77 67 96 56 62 86 87 00 00 00', check: 15 },
  { iban: 'FI73 3131 3001 0000 58', amountCents: 0, reference: 'RF10 8686 24', dueDate: '2013-08-09',
    pairs: '57 33 13 13 00 10 00 05 80 00 00 00 01 00 00 00 00 00 00 00 00 86 86 24 13 08 09', check: 91 },
  { iban: 'FI83 3301 0001 1007 75', amountCents: 15000020, reference: 'RF71 9212 5374 2525 3989 7737', dueDate: '2016-05-25',
    pairs: '58 33 30 10 00 11 00 77 51 50 00 02 07 10 92 12 53 74 25 25 39 89 77 37 16 05 25', check: 80 },
  { iban: 'FI39 3636 3002 0924 92', amountCents: 103, reference: 'RF66 5907 3839 0', dueDate: '2023-03-11',
    pairs: '53 93 63 63 00 20 92 49 20 00 00 10 36 60 00 00 00 00 00 05 90 73 83 90 23 03 11', check: 10 },
  { iban: 'FI92 3939 0001 0033 91', amountCents: 2, reference: 'RF95 1357 914', dueDate: '2099-12-24',
    pairs: '59 23 93 90 00 10 03 39 10 00 00 00 29 50 00 00 00 00 00 00 01 35 79 14 99 12 24', check: 33 },
];

// Guidelines for the QR code in the Credit Transfer Forms (2015), example 1.
export const QR_EXAMPLE_1 = {
  input: {
    bic: 'OKOYFIHH',
    recipientName: 'Asiakas T. Meikäläinen',
    iban: 'FI7944052020036082',
    amountCents: 15824,
    reference: 'RF07663321328510',
    dueDate: '2014-01-22',
  },
  payload: [
    'BCD', '001', '1', 'SCT', 'OKOYFIHH', 'Asiakas T. Meikäläinen', 'FI7944052020036082', 'EUR158.24', '',
    'RF07663321328510', '', 'ReqdExctnDt/2014-01-22',
  ].join('\n'),
};
