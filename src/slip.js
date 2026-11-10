import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import {
  PaymentSlipError,
  createQrPayload,
  createVirtualBarcode,
  encodeCode128C,
  formatIban,
  formatReference,
  normalizeAmountCents,
  normalizeIban,
  parseDueDate,
} from './codes.js';

const MM = 72 / 25.4;
export const SLIP_WIDTH = 210 * MM;
export const SLIP_HEIGHT = 101.6 * MM;

// Finance Finland Credit Transfer Guidelines (2014), section 2.13: 210 x 101.6 mm form, label column 20 mm,
// two 91.4 mm columns. Row heights follow the template in twelfths of an inch.
const X_LABEL = 20 * MM;
const X_MIDDLE = (20 + 91.4) * MM;
const X_RIGHT = (20 + 91.4 + 91.4) * MM;
const INCH12 = 25.4 / 12;
const Y_RECIPIENT = 8 * INCH12 * MM;
const Y_PAYER = 15 * INCH12 * MM;
const Y_SIGNATURE = 27 * INCH12 * MM;
const Y_FROM_ACCOUNT = 31 * INCH12 * MM;
const Y_BOTTOM_ZONE = 35 * INCH12 * MM;
const X_EURO = X_MIDDLE + 48 * MM;
const THIN = 0.13 * MM;
const THICK = 0.5 * MM;

// Bank Bar Code Guide v5.3: 20 mm quiet zone on the left, 70-105 mm long, 10-12.7 mm high, at most 5 mm below.
const BARCODE_X = 20 * MM;
const BARCODE_WIDTH = 100 * MM;
const BARCODE_HEIGHT = 11 * MM;
const BARCODE_BOTTOM_GAP = 4 * MM;
// QR guide: 0.5 mm modules, top right corner of the form, at least 2 mm from other elements.
const QR_MODULE = 0.5 * MM;
const QR_GAP = 2 * MM;

const LABELS = {
  'fi-sv': {
    title: 'TILISIIRTO. GIRERING',
    recipientAccount: ['Saajan', 'tilinumero', 'Mottagarens', 'kontonummer'],
    recipient: ['Saaja', 'Mottagare'],
    payer: ['Maksajan', 'nimi ja', 'osoite', 'Betalarens', 'namn och', 'adress'],
    signature: ['Allekirjoitus', 'Underskrift'],
    fromAccount: ['Tililtä nro', 'Från konto nr'],
    reference: ['Viitenumero', 'Ref. nr'],
    dueDate: ['Eräpäivä', 'Förfallodag'],
    euro: 'Euro',
    terms:
      'Maksu välitetään saajalle maksujenvälityksen ehtojen mukaisesti ja vain maksajan ilmoittaman tilinumeron ' +
      'perusteella.\nBetalningen förmedlas till mottagaren enligt villkoren för betalningsförmedling och endast ' +
      'till det kontonummer som betalaren angivit.',
  },
  en: {
    title: 'CREDIT TRANSFER',
    recipientAccount: ["Recipient's", 'account', 'number'],
    recipient: ['Recipient'],
    payer: ["Payer's", 'name and', 'address'],
    signature: ['Signature'],
    fromAccount: ['From account', 'no.'],
    reference: ['Ref. No.'],
    dueDate: ['Due date'],
    euro: 'Euro',
    terms:
      'The payment will be cleared for the recipient in accordance with the General terms for payment ' +
      'transmission and only on the basis of the account number given by the payer.',
  },
};

function formatEuro(cents) {
  const euros = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+$)/g, ' ');
  return `${euros},${String(cents % 100).padStart(2, '0')}`;
}

function textLines(value) {
  if (value === null || value === undefined) return [];
  return (Array.isArray(value) ? value : String(value).split('\n')).map((line) => String(line).trim()).filter(Boolean);
}

/** Validates the input and computes everything that is printed. */
export function preparePaymentSlip(data) {
  const accounts = (data.accounts ?? [{ iban: data.iban, bank: data.bank }]).map((account) => ({
    bank: String(account.bank ?? '').trim(),
    iban: normalizeIban(account.iban),
  }));
  if (!accounts.length || accounts.length > 4) {
    throw new PaymentSlipError('invalid_iban', 'Give one IBAN, or 1-4 accounts.');
  }
  const recipient = textLines(data.recipient?.name ?? data.recipientName);
  if (!recipient.length) throw new PaymentSlipError('missing_recipient', 'recipient.name is required.');
  const recipientAddress = textLines(data.recipient?.address);
  const payer = [...textLines(data.payer?.name), ...textLines(data.payer?.address)];
  const amountCents = normalizeAmountCents(data.amountCents);
  const due = parseDueDate(data.dueDate);
  const language = data.language ?? 'fi-sv';
  if (!LABELS[language]) throw new PaymentSlipError('invalid_language', 'language must be "fi-sv" or "en".');

  const primary = accounts[0].iban;
  const hasReference = Boolean(String(data.reference ?? '').trim());
  let barcode = null;
  if (data.barcode !== false && hasReference && primary.startsWith('FI')) {
    try {
      barcode = createVirtualBarcode({ iban: primary, amountCents, reference: data.reference, dueDate: data.dueDate });
    } catch (error) {
      // RF references with letters have no bar code; everything else is an input error.
      if (error.code !== 'barcode_not_possible') throw error;
    }
  }
  const qrPayload =
    data.qr === false
      ? null
      : createQrPayload({
          bic: data.bic,
          recipientName: recipient.join(' '),
          iban: primary,
          amountCents,
          reference: data.reference,
          message: data.message,
          dueDate: data.dueDate,
        });

  return {
    language,
    accounts: accounts.map((account) => ({ ...account, ibanText: formatIban(account.iban) })),
    recipient: [...recipient, ...recipientAddress],
    payer,
    info: textLines(data.info),
    message: hasReference ? '' : String(data.message ?? '').trim(),
    reference: hasReference ? formatReference(data.reference) : '',
    dueDate: due ? `${due.day}.${due.month}.${due.year}` : '',
    amount: amountCents === null ? '' : formatEuro(amountCents),
    barcode,
    qrPayload,
  };
}

function drawLabel(doc, lines, x, y, width, align = 'right') {
  doc.font('Helvetica').fontSize(7).fillColor('#000000');
  doc.text(lines.join('\n'), x, y, { width, align, lineGap: -1 });
}

function drawQr(doc, payload, right, top) {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const size = modules.size * QR_MODULE;
  const left = right - size;
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) doc.rect(left + col * QR_MODULE, top + row * QR_MODULE, QR_MODULE, QR_MODULE);
    }
  }
  doc.fillColor('#000000').fill();
  return size;
}

function drawBarcode(doc, digits, x, bottom) {
  const { widths } = encodeCode128C(digits);
  const modules = widths.reduce((sum, w) => sum + w, 0);
  const unit = BARCODE_WIDTH / modules;
  let cursor = x;
  widths.forEach((w, i) => {
    if (i % 2 === 0) doc.rect(cursor, bottom - BARCODE_HEIGHT, w * unit, BARCODE_HEIGHT);
    cursor += w * unit;
  });
  doc.fillColor('#000000').fill();
}

/**
 * Draws the credit transfer form (210 x 101.6 mm) into an existing PDFKit document.
 * By default it is placed at the bottom of the current A4 page.
 * @returns the prepared data (bar code digits, QR payload and printed texts).
 */
export function drawPaymentSlip(doc, data, options = {}) {
  const slip = preparePaymentSlip(data);
  const labels = LABELS[slip.language];
  const x0 = options.x ?? 0;
  const y0 = options.y ?? doc.page.height - SLIP_HEIGHT;
  const X = (x) => x0 + x;
  const Y = (y) => y0 + y;

  doc.save();
  if (options.cutLine !== false) {
    doc.lineWidth(THIN).strokeColor('#000000').dash(3, { space: 3 });
    doc.moveTo(X(0), Y(0)).lineTo(X(SLIP_WIDTH), Y(0)).stroke().undash();
  }

  // Ruling: thick lines between the main fields, thin lines inside them.
  doc.strokeColor('#000000').lineWidth(THICK);
  doc.moveTo(X(X_MIDDLE), Y(0)).lineTo(X(X_MIDDLE), Y(Y_BOTTOM_ZONE)).stroke();
  doc.moveTo(X(X_LABEL), Y(Y_PAYER)).lineTo(X(X_MIDDLE), Y(Y_PAYER)).stroke();
  doc.moveTo(X(X_LABEL), Y(Y_FROM_ACCOUNT)).lineTo(X(X_RIGHT), Y(Y_FROM_ACCOUNT)).stroke();
  doc.moveTo(X(X_LABEL), Y(Y_BOTTOM_ZONE)).lineTo(X(X_RIGHT), Y(Y_BOTTOM_ZONE)).stroke();
  doc.lineWidth(THIN);
  doc.moveTo(X(X_LABEL), Y(Y_RECIPIENT)).lineTo(X(X_MIDDLE), Y(Y_RECIPIENT)).stroke();
  doc.moveTo(X(X_LABEL), Y(Y_SIGNATURE)).lineTo(X(X_RIGHT), Y(Y_SIGNATURE)).stroke();
  doc.moveTo(X(X_EURO), Y(Y_FROM_ACCOUNT)).lineTo(X(X_EURO), Y(Y_BOTTOM_ZONE)).stroke();
  // Signature guide line.
  doc.moveTo(X(X_LABEL + 4 * MM), Y(Y_FROM_ACCOUNT - 1.5 * MM)).lineTo(X(X_MIDDLE - 4 * MM), Y(Y_FROM_ACCOUNT - 1.5 * MM)).stroke();

  // Labels in the left column and in the right half.
  const labelWidth = X_LABEL - 2 * MM;
  drawLabel(doc, labels.recipientAccount, X(0), Y(1.5 * MM), labelWidth);
  drawLabel(doc, labels.recipient, X(0), Y(Y_RECIPIENT + 1.5 * MM), labelWidth);
  drawLabel(doc, labels.payer, X(0), Y(Y_PAYER + 1.5 * MM), labelWidth);
  drawLabel(doc, labels.signature, X(0), Y(Y_SIGNATURE + 1 * MM), labelWidth);
  drawLabel(doc, labels.fromAccount, X(0), Y(Y_FROM_ACCOUNT + 1 * MM), labelWidth);
  drawLabel(doc, labels.reference, X(X_MIDDLE + 1 * MM), Y(Y_SIGNATURE + 1 * MM), 20 * MM, 'left');
  drawLabel(doc, labels.dueDate, X(X_MIDDLE + 1 * MM), Y(Y_FROM_ACCOUNT + 1 * MM), 20 * MM, 'left');
  drawLabel(doc, [labels.euro], X(X_EURO + 1 * MM), Y(Y_FROM_ACCOUNT + 1 * MM), 15 * MM, 'left');
  doc.font('Helvetica').fontSize(6).text('IBAN', X(X_LABEL + 2 * MM), Y(1 * MM));

  // Form title, rotated in the left margin.
  doc.save().rotate(-90, { origin: [X(3 * MM), Y(Y_SIGNATURE)] });
  doc.font('Helvetica-Bold').fontSize(8).text(labels.title, X(3 * MM), Y(Y_SIGNATURE) - 4, { lineBreak: false });
  doc.restore();

  // Data, at least 9 pt.
  const dataX = X(X_LABEL + 2 * MM);
  const dataWidth = X_MIDDLE - X_LABEL - 4 * MM;
  doc.font('Helvetica').fontSize(9).fillColor('#000000');
  const accountTop = slip.accounts.length > 2 ? Y(2.5 * MM) : Y(5 * MM);
  slip.accounts.forEach((account, i) => {
    const y = accountTop + i * 9.5;
    if (account.bank) doc.text(account.bank.toUpperCase(), dataX + 6 * MM, y, { width: 28 * MM, lineBreak: false });
    doc.text(account.ibanText, dataX + (account.bank ? 34 * MM : 6 * MM), y, { lineBreak: false });
  });
  doc.text(slip.recipient.join('\n'), dataX, Y(Y_RECIPIENT + 1.5 * MM), { width: dataWidth, height: Y_PAYER - Y_RECIPIENT - 2 * MM, lineGap: -1 });
  if (slip.payer.length) {
    doc.text(slip.payer.join('\n'), dataX, Y(Y_PAYER + 3 * MM), { width: dataWidth, height: Y_SIGNATURE - Y_PAYER - 4 * MM });
  }
  doc.fontSize(10);
  doc.text(slip.reference, X(X_MIDDLE + 22 * MM), Y(Y_SIGNATURE + 2.5 * MM), { width: X_RIGHT - X_MIDDLE - 24 * MM, lineBreak: false });
  doc.text(slip.dueDate, X(X_MIDDLE + 22 * MM), Y(Y_FROM_ACCOUNT + 2.5 * MM), { width: X_EURO - X_MIDDLE - 23 * MM, lineBreak: false });
  doc.text(slip.amount, X(X_EURO + 10 * MM), Y(Y_FROM_ACCOUNT + 2.5 * MM), { width: X_RIGHT - X_EURO - 12 * MM, align: 'right', lineBreak: false });

  // Information section (upper right) and the QR code in its top right corner.
  let qrSize = 0;
  if (slip.qrPayload) qrSize = drawQr(doc, slip.qrPayload, X(X_RIGHT - QR_GAP), Y(QR_GAP));
  const infoLines = [...slip.info, ...(slip.message ? [slip.message] : [])];
  if (infoLines.length) {
    doc.font('Helvetica').fontSize(9);
    doc.text(infoLines.join('\n'), X(X_MIDDLE + 3 * MM), Y(3 * MM), {
      width: X_RIGHT - X_MIDDLE - 6 * MM - (qrSize ? qrSize + QR_GAP : 0),
      height: Y_SIGNATURE - 6 * MM,
    });
  }

  // Bottom zone: bank bar code and the clearing terms.
  if (slip.barcode) drawBarcode(doc, slip.barcode, X(BARCODE_X), Y(SLIP_HEIGHT - BARCODE_BOTTOM_GAP));
  doc.font('Helvetica').fontSize(6).fillColor('#000000');
  doc.text(labels.terms, X(BARCODE_X + BARCODE_WIDTH + 6 * MM), Y(Y_BOTTOM_ZONE + 2 * MM), {
    width: X_RIGHT - BARCODE_X - BARCODE_WIDTH - 6 * MM,
  });
  doc.restore();
  return slip;
}

/** Creates an A4 PDF with only the payment slip at the bottom. Resolves to a Buffer. */
export function createPaymentSlipPdf(data, options = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: options.title ?? 'Payment slip' } });
  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      drawPaymentSlip(doc, data, options);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
