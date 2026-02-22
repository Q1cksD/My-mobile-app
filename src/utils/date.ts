export function todayKey(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function last7Days(): string[] {
  const days: string[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().split('T')[0] ?? '');
  }

  return days;
}
