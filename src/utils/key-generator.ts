import { customAlphabet } from 'nanoid';

// Alphanumeric (uppercase) without ambiguous chars (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 4);

/**
 * Generate a license key in XXXX-XXXX-XXXX-XXXX format.
 */
export function generateLicenseKey(): string {
  return `${generate()}-${generate()}-${generate()}-${generate()}`;
}

/** Default Pro feature set */
export const PRO_FEATURES = [
  'unlimited_sites',
  'multi_php',
  'ssl_ca',
  'tunneling',
  'advanced_services',
  'auto_updates',
  'priority_support',
];

/** Default Free feature set */
export const FREE_FEATURES: string[] = [];
