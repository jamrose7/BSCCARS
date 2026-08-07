function formatIncidentTime(value) {
  const time = String(value || "").trim();
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;

  const hour = Number(match[1]);
  const minutes = match[2];
  if (hour > 23 || Number(minutes) > 59) return time;

  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

module.exports = { formatIncidentTime };
