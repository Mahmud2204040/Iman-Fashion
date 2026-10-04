// Shop accounting uses Asia/Dhaka (UTC+06:00), independent of browser timezone.
export function cashBusinessDate(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid cash date.');
  return new Date(date.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function cashDayStart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('A valid cash date is required.');
  const date = new Date(`${value}T00:00:00+06:00`);
  if (Number.isNaN(date.getTime()) || cashBusinessDate(date) !== value) throw new Error('Invalid cash date.');
  return date;
}

export function cashDateRange(filters = {}, now = new Date()) {
  if (Array.isArray(filters)) return filters;
  const today = cashBusinessDate(now);
  const preset = filters.preset || filters.range || 'today';
  let from = today;
  let to = today;
  if (preset === 'custom' || filters.from || filters.start) {
    from = filters.from || filters.start || today;
    to = filters.to || filters.end || today;
  } else if (preset === 'month') from = `${today.slice(0, 7)}-01`;
  else if (preset === 'year') from = `${today.slice(0, 4)}-01-01`;
  else if (preset === 'week') {
    const day = new Date(`${today}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - day.getUTCDay());
    from = day.toISOString().slice(0, 10);
  }
  if (from > to) [from, to] = [to, from];
  return [cashDayStart(from), new Date(cashDayStart(to).getTime() + 86400000 - 1)];
}
