function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export function lastNDays(daysCount: number): string[] {
  const normalized = Math.max(1, Math.floor(daysCount));
  const days: string[] = [];
  const now = new Date();

  for (let i = normalized - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(formatDateKey(d));
  }

  return days;
}

export function last7Days(): string[] {
  return lastNDays(7);
}

export function displayDate(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
