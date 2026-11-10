// Finnish payment codes: references, IBAN, bank bar code (virtual bar code) and the QR payload.
// Sources: Finance Finland guides on www.finanssiala.fi (Forming a Finnish reference number, Structure of the
// RF Creditor Reference, Bank Bar Code Guide v5.3, Guidelines for the QR code in the Credit Transfer Forms 2015).

export class PaymentSlipError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'PaymentSlipError';
    this.code = code;
  }
}

const compact = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

/** Converts letters to numbers (A=10 ... Z=35) and returns value mod 97. */
function mod97(text) {
  let remainder = 0;
  for (const char of text) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

// --- Finnish national reference -------------------------------------------------------------------------------

function nationalCheckDigit(base) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = base.length - 1, n = 0; i >= 0; i -= 1, n += 1) sum += Number(base[i]) * weights[n % 3];
  return (10 - (sum % 10)) % 10;
}

/** Builds a Finnish reference from a base of 3-19 digits by appending the 7-3-1 check digit. */
export function createFinnishReference(base) {
  const digits = compact(base).replace(/^0+/, '');
  if (!/^\d{3,19}$/.test(digits)) {
    throw new PaymentSlipError('invalid_reference', 'Reference base must be 3-19 digits (leading zeros ignored).');
  }
  return `${digits}${nationalCheckDigit(digits)}`;
}

export function isValidFinnishReference(reference) {
  const digits = compact(reference).replace(/^0+/, '');
  return /^\d{4,20}$/.test(digits) && nationalCheckDigit(digits.slice(0, -1)) === Number(digits.at(-1));
}

// --- RF creditor reference (ISO 11649) ------------------------------------------------------------------------

/** Builds an RF reference from 1-21 letters or digits, e.g. a Finnish reference. */
export function createRfReference(body) {
  const value = compact(body);
  if (!/^[A-Z0-9]{1,21}$/.test(value)) {
    throw new PaymentSlipError('invalid_reference', 'RF reference body must be 1-21 letters or digits.');
  }
  const check = 98 - mod97(`${value}RF00`);
  return `RF${String(check).padStart(2, '0')}${value}`;
}

export function isValidRfReference(reference) {
  const value = compact(reference);
  return /^RF\d{2}[A-Z0-9]{1,21}$/.test(value) && mod97(`${value.slice(4)}${value.slice(0, 4)}`) === 1;
}

/** Validates a Finnish or RF reference and returns it in machine-readable form. */
export function parseReference(reference) {
  const value = compact(reference);
  if (value.startsWith('RF')) {
    if (!isValidRfReference(value)) throw new PaymentSlipError('invalid_reference', `Invalid RF reference "${reference}".`);
    return { type: 'rf', value };
  }
  if (!isValidFinnishReference(value)) {
    throw new PaymentSlipError('invalid_reference', `Invalid Finnish reference "${reference}".`);
  }
  return { type: 'finnish', value: value.replace(/^0+/, '') };
}

/** Paper format: Finnish in groups of five from the right, RF in groups of four from the left. */
export function formatReference(reference) {
  const { type, value } = parseReference(reference);
  if (type === 'rf') return value.replace(/(.{4})(?=.)/g, '$1 ');
  return value.replace(/\B(?=(\d{5})+$)/g, ' ');
}

// --- IBAN -----------------------------------------------------------------------------------------------------

export function isValidIban(iban) {
  const value = compact(iban);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value) && mod97(`${value.slice(4)}${value.slice(0, 4)}`) === 1;
}

export function normalizeIban(iban) {
  const value = compact(iban);
  if (!isValidIban(value)) throw new PaymentSlipError('invalid_iban', `Invalid IBAN "${iban}".`);
  return value;
}

export function formatIban(iban) {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

// --- Amount and date ------------------------------------------------------------------------------------------

/** Amount in cents, or null when the payer chooses the amount. */
export function normalizeAmountCents(amountCents) {
  if (amountCents === null || amountCents === undefined) return null;
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new PaymentSlipError('invalid_amount', 'amountCents must be a non-negative integer or null.');
  }
  return amountCents;
}

/** Accepts YYYY-MM-DD or a Date (its UTC date). Returns { year, month, day } or null. */
export function parseDueDate(dueDate) {
  if (dueDate === null || dueDate === undefined || dueDate === '') return null;
  let year;
  let month;
  let day;
  if (dueDate instanceof Date && !Number.isNaN(dueDate.getTime())) {
    [year, month, day] = [dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, dueDate.getUTCDate()];
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate));
    if (match) [year, month, day] = match.slice(1).map(Number);
  }
  const check = new Date(Date.UTC(year, (month ?? 0) - 1, day));
  if (!year || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new PaymentSlipError('invalid_due_date', 'dueDate must be YYYY-MM-DD or a valid Date.');
  }
  return { year, month, day };
}

const pad2 = (n) => String(n).padStart(2, '0');

// --- Bank bar code (virtual bar code), versions 4 and 5 -------------------------------------------------------

const MAX_BARCODE_CENTS = 99_999_999;

/**
 * Returns the 54-digit bank bar code. Version 4 for Finnish references, version 5 for RF references.
 * Amounts over 999 999,99 € and a payer-chosen amount are encoded as zeros, as the guide allows.
 */
export function createVirtualBarcode({ iban, amountCents, reference, dueDate }) {
  const account = normalizeIban(iban);
  if (!account.startsWith('FI')) {
    throw new PaymentSlipError('barcode_not_possible', 'The bank bar code is only defined for Finnish (FI) IBANs.');
  }
  const cents = normalizeAmountCents(amountCents);
  const amount = String(cents === null || cents > MAX_BARCODE_CENTS ? 0 : cents).padStart(8, '0');
  const due = parseDueDate(dueDate);
  const date = due ? `${pad2(due.year % 100)}${pad2(due.month)}${pad2(due.day)}` : '000000';
  const ref = parseReference(reference);

  let code;
  if (ref.type === 'finnish') {
    code = `4${account.slice(2)}${amount}000${ref.value.padStart(20, '0')}${date}`;
  } else {
    const body = ref.value.slice(4);
    if (!/^\d+$/.test(body)) {
      throw new PaymentSlipError('barcode_not_possible', 'RF references with letters cannot be encoded in the bar code.');
    }
    code = `5${account.slice(2)}${amount}${ref.value.slice(2, 4)}${body.padStart(21, '0')}${date}`;
  }
  return code;
}

// --- Code 128, character set C --------------------------------------------------------------------------------

// Bar and space widths (bar first) for values 0-106. 105 = START C, 106 = STOP.
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_C = 105;
const STOP = 106;

/** Encodes an even number of digits. Returns the symbol values and the module widths, bar first. */
export function encodeCode128C(digits) {
  if (!/^(\d\d)+$/.test(digits)) {
    throw new PaymentSlipError('invalid_barcode', 'Code 128 C needs an even number of digits.');
  }
  const data = digits.match(/\d\d/g).map(Number);
  const check = data.reduce((sum, value, i) => sum + value * (i + 1), START_C) % 103;
  const values = [START_C, ...data, check, STOP];
  const widths = values.flatMap((value) => [...CODE128_PATTERNS[value]].map(Number));
  return { values, check, widths };
}

// --- QR code payload (Finance Finland 2015, based on EPC069-12) -----------------------------------------------

const QR_MAX_BYTES = 331;

function qrField(value, max, name) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if ([...text].length > max) throw new PaymentSlipError('qr_field_too_long', `${name} is longer than ${max} characters.`);
  return text;
}

/**
 * Builds the QR payload. Version 001 (Finance Finland guide) needs the BIC. Without a BIC, version 002 of the
 * EPC guideline is used, where the BIC is optional within the EEA.
 */
export function createQrPayload({ bic, recipientName, iban, amountCents, reference, message, dueDate }) {
  const swift = compact(bic);
  if (swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) {
    throw new PaymentSlipError('invalid_bic', `Invalid BIC "${bic}".`);
  }
  const name = qrField(recipientName, 70, 'recipientName');
  if (!name) throw new PaymentSlipError('missing_recipient', 'recipientName is required.');

  const cents = normalizeAmountCents(amountCents);
  if (cents !== null && cents > 99_999_999_999) {
    throw new PaymentSlipError('invalid_amount', 'The QR code amount must be at most 999 999 999,99 €.');
  }
  const amount = cents ? `EUR${Math.floor(cents / 100)}.${pad2(cents % 100)}` : '';
  const ref = reference ? parseReference(reference).value : '';
  const unstructured = ref ? '' : qrField(message, 140, 'message');
  const due = parseDueDate(dueDate);

  const lines = [
    'BCD',
    swift ? '001' : '002',
    '1',
    'SCT',
    swift,
    name,
    normalizeIban(iban),
    amount,
    '',
    ref,
    unstructured,
    due ? `ReqdExctnDt/${due.year}-${pad2(due.month)}-${pad2(due.day)}` : '',
  ];
  while (lines.at(-1) === '') lines.pop();
  const payload = lines.join('\n');
  if (Buffer.byteLength(payload, 'utf8') > QR_MAX_BYTES) {
    throw new PaymentSlipError('qr_too_long', `QR payload exceeds ${QR_MAX_BYTES} bytes.`);
  }
  return payload;
}
