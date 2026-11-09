/**
 * Safely formats any address shape (string, Mongoose Delivery address object, or nested location)
 * into a clean, human-readable string suitable for direct React child rendering.
 */
export function formatAddress(addr: unknown): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, unknown>;

    // Handle common address fields { street, city, zone, postalCode }
    const parts = [a.street, a.city, a.zone, a.postalCode].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0
    );
    if (parts.length > 0) return parts.join(', ');

    if (typeof a.address === 'string' && a.address.trim()) return a.address;
    if (typeof a.formattedAddress === 'string' && a.formattedAddress.trim()) return a.formattedAddress;
    if (typeof a.name === 'string' && a.name.trim()) return a.name;
    if (typeof a.street === 'string' && a.street.trim()) return a.street;
    if (typeof a.zone === 'string' && a.zone.trim()) return a.zone;
  }
  return '';
}
