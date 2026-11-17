export interface FilingNumberParts {
  /** First 12 digits. This is the desk code used to match the directory. */
  deskCode: string;
  /** Desk segment as it appears inside the 23-digit filing number: 76-001-41-89-001 */
  deskLabel: string;
  year: string;
  consecutive: string;
  instance: string;
}

/**
 * A Colombian filing number has 23 digits:
 * desk (12) + year (4) + consecutive (5) + instance (2).
 * Example: 76001418900120250126300
 *   desk 760014189001, year 2025, consecutive 01263, instance 00.
 * Returns null when the value is not exactly 23 digits.
 */
export function parseFilingNumber(value: string | number | null | undefined): FilingNumberParts | null {
  if (value === null || value === undefined) {
    return null;
  }

  const digits = value.toString().replace(/\D/g, '');
  if (digits.length !== 23) {
    return null;
  }

  const deskCode = digits.slice(0, 12);

  return {
    deskCode,
    deskLabel: [
      digits.slice(0, 2),
      digits.slice(2, 5),
      digits.slice(5, 7),
      digits.slice(7, 9),
      digits.slice(9, 12),
    ].join('-'),
    year: digits.slice(12, 16),
    consecutive: digits.slice(16, 21),
    instance: digits.slice(21, 23),
  };
}
