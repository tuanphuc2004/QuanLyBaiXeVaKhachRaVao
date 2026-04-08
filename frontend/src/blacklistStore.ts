/**
 * Blacklist store: persist to localStorage so check-in/registration pages can block blacklisted CCCD/plates.
 * To allow someone in, remove them from Danh sách đen first.
 */

export interface BlacklistItem {
  id: number;
  idNumber?: string;
  plateNumber?: string;
  reason?: string;
}

const STORAGE_KEY = "blacklist_items";

const defaultItems: BlacklistItem[] = [
  { id: 1, idNumber: "012345678901", reason: "Vi phạm nội quy" },
  { id: 2, plateNumber: "51A-12345", reason: "Không tuân thủ quy định giao hàng" }
];

export function getBlacklistFromStorage(): BlacklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...defaultItems];
    const parsed = JSON.parse(raw) as BlacklistItem[];
    return Array.isArray(parsed) ? parsed : [...defaultItems];
  } catch {
    return [...defaultItems];
  }
}

export function setBlacklistToStorage(items: BlacklistItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function normalizeIdNumber(value: string): string {
  return (value || "").trim();
}

function normalizePlateNumber(value: string): string {
  return (value || "").trim().toUpperCase();
}

export function isBlacklistedGuest(idNumber: string): boolean {
  const normalized = normalizeIdNumber(idNumber);
  if (!normalized) return false;
  const items = getBlacklistFromStorage();
  return items.some(
    (x) => x.idNumber && normalizeIdNumber(x.idNumber) === normalized
  );
}

export function isBlacklistedVehicle(plateNumber: string): boolean {
  const normalized = normalizePlateNumber(plateNumber);
  if (!normalized) return false;
  const items = getBlacklistFromStorage();
  return items.some(
    (x) => x.plateNumber && normalizePlateNumber(x.plateNumber) === normalized
  );
}
