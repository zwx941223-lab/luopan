import dayjs from "dayjs";

export function getNowIso() {
  return new Date().toISOString();
}

export function toHourKey(dateString) {
  return dayjs(dateString).format("YYYY-MM-DD HH:00");
}

export function subtractHours(dateString, hours) {
  return dayjs(dateString).subtract(hours, "hour").toISOString();
}

export function isAfter(dateString, baseline) {
  return dayjs(dateString).isAfter(dayjs(baseline));
}
