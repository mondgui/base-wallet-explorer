import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  type Address,
} from "viem";
import { base } from "viem/chains";

// Reads Base. This client cannot sign or send a transaction.
const BASE_RPC = "https://base-rpc.publicnode.com";

// Circle's USDC on Base. It uses 6 decimal places, so 1 USDC is 1_000_000 units.
export const USDC_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const USDC_DECIMALS = 6;
export const ETH_DECIMALS = 18;

export const SAMPLE_WALLET: Address =
  "0xf5c4f3dc02c3fb9279495a8fef7b0741da956157";
export const EMPTY_WALLET: Address =
  "0x333234026fde62aed7f75bb713baa38307df5bc1";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const usdcBalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

// A free public node will search recent blocks only. Older USDC history
// needs a block explorer. About 9,000 Base blocks is roughly five hours.
const LOOKBACK_CANDIDATES = [9000n, 6000n, 3000n, 800n] as const;
const TRANSFER_LIMIT = 8;

export const client = createPublicClient({
  chain: base,
  transport: http(BASE_RPC, { timeout: 20_000 }),
});

export type TransferDirection = "in" | "out" | "self";

export type UsdcTransfer = {
  hash: `0x${string}`;
  from: Address;
  to: Address;
  amount: bigint;
  blockNumber: bigint;
  direction: TransferDirection;
  timestamp: Date | null;
};

export type WalletSnapshot = {
  address: Address;
  eth: bigint;
  usdc: bigint;
  blockNumber: bigint;
  windowStart: bigint;
  windowStartTime: Date | null;
  transfers: UsdcTransfer[];
};

export function normalizeAddress(value: string): Address {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw new Error(
      "That is not an address. Paste the full 0x address, 42 characters.",
    );
  }
  return getAddress(trimmed);
}

function isRangeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /archive|range|too many|exceed|limit|more than/i.test(message);
}

export async function readWallet(input: string): Promise<WalletSnapshot> {
  const address = normalizeAddress(input);
  const [eth, usdc, blockNumber] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: USDC_ADDRESS,
      abi: usdcBalanceAbi,
      functionName: "balanceOf",
      args: [address],
    }),
    client.getBlockNumber(),
  ]);

  const { transfers, windowStart } = await readRecentUsdcTransfers(
    address,
    blockNumber,
  );
  const withTimes = await attachTimestamps(transfers, windowStart);

  return {
    address,
    eth,
    usdc,
    blockNumber,
    windowStart,
    windowStartTime: withTimes.windowStartTime,
    transfers: withTimes.transfers,
  };
}

async function readRecentUsdcTransfers(address: Address, latest: bigint) {
  let lastError: unknown;

  for (const span of LOOKBACK_CANDIDATES) {
    const windowStart = latest > span ? latest - span : 0n;
    try {
      const [incoming, outgoing] = await Promise.all([
        client.getLogs({
          address: USDC_ADDRESS,
          event: transferEvent,
          args: { to: address },
          fromBlock: windowStart,
          toBlock: latest,
        }),
        client.getLogs({
          address: USDC_ADDRESS,
          event: transferEvent,
          args: { from: address },
          fromBlock: windowStart,
          toBlock: latest,
        }),
      ]);

      const byId = new Map<string, UsdcTransfer & { logIndex: number }>();
      for (const log of [...incoming, ...outgoing]) {
        if (
          !log.transactionHash ||
          log.blockNumber == null ||
          log.logIndex == null ||
          !log.args.from ||
          !log.args.to ||
          log.args.value == null
        ) {
          continue;
        }

        const from = getAddress(log.args.from);
        const to = getAddress(log.args.to);
        const direction: TransferDirection =
          from === address && to === address
            ? "self"
            : from === address
              ? "out"
              : "in";

        byId.set(`${log.transactionHash}:${log.logIndex}`, {
          hash: log.transactionHash,
          from,
          to,
          amount: log.args.value,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          direction,
          timestamp: null,
        });
      }

      const transfers = [...byId.values()]
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber > b.blockNumber ? -1 : 1;
          }
          return a.logIndex > b.logIndex ? -1 : 1;
        })
        .slice(0, TRANSFER_LIMIT)
        .map(({ logIndex: _logIndex, ...transfer }) => transfer);

      return { transfers, windowStart };
    } catch (error) {
      lastError = error;
      if (!isRangeError(error)) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Base did not return recent transfers.");
}

async function attachTimestamps(
  transfers: UsdcTransfer[],
  windowStart: bigint,
): Promise<{ transfers: UsdcTransfer[]; windowStartTime: Date | null }> {
  const needed = new Set<bigint>([windowStart, ...transfers.map((t) => t.blockNumber)]);
  const timestamps = new Map<bigint, Date>();

  await Promise.all(
    [...needed].map(async (blockNumber) => {
      try {
        const block = await client.getBlock({ blockNumber });
        timestamps.set(blockNumber, new Date(Number(block.timestamp) * 1000));
      } catch {
        // A missing timestamp still leaves the balance and the transfer amount.
      }
    }),
  );

  return {
    windowStartTime: timestamps.get(windowStart) ?? null,
    transfers: transfers.map((transfer) => ({
      ...transfer,
      timestamp: timestamps.get(transfer.blockNumber) ?? null,
    })),
  };
}
