/**
 * Format a number with spaces as thousands separator (Algerian/French style)
 * e.g. 1234567 → "1 234 567"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-DZ').format(value);
}

/**
 * Format currency in Algerian Dinar
 * e.g. 2145000 → "2 145 000 DZD"
 */
export function formatCurrency(value: number, currency = 'DZD'): string {
  return `${formatNumber(value)} ${currency}`;
}

/**
 * Format a date string to localized display
 * e.g. "2024-05-14T10:15:00" → "14/05/2024 10:15"
 */
export function formatDateTime(dateStr: string, lang = 'fr'): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(dateStr: string, lang = 'fr'): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/**
 * Calculate age from date of birth string
 */
export function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Format a relative time like "il y a 5 min"
 */
export function formatRelativeTime(dateStr: string, lang = 'fr'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (lang === 'ar') {
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHour < 24) return `منذ ${diffHour} ساعة`;
    return `منذ ${diffDay} يوم`;
  }
  if (lang === 'en') {
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  }
  // fr
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  return `il y a ${diffDay}j`;
}

/**
 * Get initials from a full name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Format occupancy percentage as string
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
