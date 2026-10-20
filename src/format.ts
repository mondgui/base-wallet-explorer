export function formatToken(
  value: bigint,
  decimals: number,
  maxFraction = 6,
): string {
  if (value === 0n) return "0";

  const negative = value < 0n;
  const amount = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const fractionDigits = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFraction)
    .replace(/0+$/, "");

  if (whole === 0n && fractionDigits === "") {
    const dust = `0.${"0".repeat(Math.max(maxFraction - 1, 0))}1`;
    return `${negative ? "-" : ""}< ${dust}`;
  }

  const text = fractionDigits
    ? `${groupDigits(whole.toString())}.${fractionDigits}`
    : groupDigits(whole.toString());
  return negative ? `-${text}` : text;
}

export function formatBlock(block: bigint): string {
  return groupDigits(block.toString());
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatWhen(date: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return formatClock(date);
}

export function formatClock(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
