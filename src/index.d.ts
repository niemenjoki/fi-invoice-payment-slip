/// <reference types="node" />

export type PaymentSlipErrorCode =
  | 'invalid_reference'
  | 'invalid_iban'
  | 'invalid_amount'
  | 'invalid_due_date'
  | 'invalid_bic'
  | 'invalid_language'
  | 'invalid_barcode'
  | 'missing_recipient'
  | 'barcode_not_possible'
  | 'qr_field_too_long'
  | 'qr_too_long';

export class PaymentSlipError extends Error {
  readonly name: 'PaymentSlipError';
  readonly code: PaymentSlipErrorCode;
}

/** YYYY-MM-DD, or a Date whose UTC date is used. */
export type DueDate = string | Date | null | undefined;

export function createFinnishReference(base: string | number): string;
export function isValidFinnishReference(reference: string): boolean;
export function createRfReference(body: string): string;
export function isValidRfReference(reference: string): boolean;
export function parseReference(reference: string): { type: 'finnish' | 'rf'; value: string };
export function formatReference(reference: string): string;
export function isValidIban(iban: string): boolean;
export function normalizeIban(iban: string): string;
export function formatIban(iban: string): string;

export interface VirtualBarcodeInput {
  iban: string;
  /** null = payer chooses the amount (encoded as zeros). */
  amountCents: number | null;
  reference: string;
  dueDate?: DueDate;
}
export function createVirtualBarcode(input: VirtualBarcodeInput): string;

export const CODE128_PATTERNS: readonly string[];
export function encodeCode128C(digits: string): { values: number[]; check: number; widths: number[] };

export interface QrPayloadInput {
  /** With BIC: version 001 (Finance Finland guide). Without: EPC version 002. */
  bic?: string;
  recipientName: string;
  iban: string;
  amountCents?: number | null;
  reference?: string;
  /** Used only when there is no reference. */
  message?: string;
  dueDate?: DueDate;
}
export function createQrPayload(input: QrPayloadInput): string;

export interface PaymentSlipAccount {
  iban: string;
  /** Short bank name printed before the IBAN, e.g. "OP". */
  bank?: string;
}

export interface PaymentSlipData {
  /** 1-4 accounts. The first one is encoded in the bar code and the QR code. */
  accounts?: PaymentSlipAccount[];
  /** Shorthand for a single account. */
  iban?: string;
  bank?: string;
  bic?: string;
  recipient: { name: string | string[]; address?: string | string[] };
  payer?: { name?: string | string[]; address?: string | string[] };
  /** null = payer chooses the amount. */
  amountCents: number | null;
  /** Finnish or RF reference. Without it, `message` is used and no bar code is printed. */
  reference?: string;
  message?: string;
  dueDate?: DueDate;
  /** Free text in the information section (upper right). */
  info?: string | string[];
  /** Form labels: Finnish and Swedish together, or English. Default: fi-sv */
  language?: 'fi-sv' | 'en';
  /** Default true. */
  barcode?: boolean;
  /** Default true. */
  qr?: boolean;
}

export interface PreparedPaymentSlip {
  language: 'fi-sv' | 'en';
  accounts: { bank: string; iban: string; ibanText: string }[];
  recipient: string[];
  payer: string[];
  info: string[];
  message: string;
  reference: string;
  dueDate: string;
  amount: string;
  barcode: string | null;
  qrPayload: string | null;
}

export interface DrawOptions {
  /** Left edge in points. Default 0 (the form is 210 mm wide, like A4). */
  x?: number;
  /** Top edge in points. Default: bottom of the current page. */
  y?: number;
  /** Dashed cut line on the top edge. Default true. */
  cutLine?: boolean;
}

/** Width and height of the form in PDF points (210 x 101.6 mm). */
export const SLIP_WIDTH: number;
export const SLIP_HEIGHT: number;

export function preparePaymentSlip(data: PaymentSlipData): PreparedPaymentSlip;
/** `doc` is a PDFKit document. */
export function drawPaymentSlip(doc: unknown, data: PaymentSlipData, options?: DrawOptions): PreparedPaymentSlip;
export function createPaymentSlipPdf(data: PaymentSlipData, options?: DrawOptions & { title?: string }): Promise<Buffer>;
