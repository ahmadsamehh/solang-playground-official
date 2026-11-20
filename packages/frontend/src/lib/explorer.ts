const STELLAR_EXPERT_TESTNET = "https://stellar.expert/explorer/testnet";

export const explorerUrl = {
  tx: (hash: string) => `${STELLAR_EXPERT_TESTNET}/tx/${hash}`,
  contract: (id: string) => `${STELLAR_EXPERT_TESTNET}/contract/${id}`,
  account: (id: string) => `${STELLAR_EXPERT_TESTNET}/account/${id}`,
};

/** Matches tx hashes, contract IDs (C…) and account IDs (G…) inside free text. */
export const LINKABLE_PATTERN = /\b([a-f0-9]{64}|C[A-Z2-7]{55}|G[A-Z2-7]{55})\b/g;

export function explorerUrlFor(token: string): string | null {
  if (/^[a-f0-9]{64}$/.test(token)) return explorerUrl.tx(token);
  if (/^C[A-Z2-7]{55}$/.test(token)) return explorerUrl.contract(token);
  if (/^G[A-Z2-7]{55}$/.test(token)) return explorerUrl.account(token);
  return null;
}

export function shortId(id: string, head = 6, tail = 4): string {
  if (!id || id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
