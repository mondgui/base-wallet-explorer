import {
  EMPTY_WALLET,
  ETH_DECIMALS,
  SAMPLE_WALLET,
  USDC_DECIMALS,
  readWallet,
  type UsdcTransfer,
  type WalletSnapshot,
} from "./chain";
import {
  formatBlock,
  formatClock,
  formatToken,
  formatWhen,
  shortAddress,
} from "./format";
import "./style.css";

const form = required<HTMLFormElement>("#lookup");
const input = required<HTMLInputElement>("#address");
const submit = required<HTMLButtonElement>("#submit");
const formError = required<HTMLParagraphElement>("#form-error");
const status = required<HTMLParagraphElement>("#status");
const result = required<HTMLElement>("#result");
const resultAddress = required<HTMLParagraphElement>("#result-address");
const basescan = required<HTMLAnchorElement>("#basescan");
const asOf = required<HTMLParagraphElement>("#as-of");
const ethBalance = required<HTMLParagraphElement>("#eth");
const usdcBalance = required<HTMLParagraphElement>("#usdc");
const windowNote = required<HTMLParagraphElement>("#window");
const transferList = required<HTMLUListElement>("#transfers");
const transferEmpty = required<HTMLParagraphElement>("#transfers-empty");

let requestId = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void lookup(input.value);
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-example]")) {
  button.addEventListener("click", () => {
    const example = button.dataset.example === "empty" ? EMPTY_WALLET : SAMPLE_WALLET;
    input.value = example;
    void lookup(example);
  });
}

async function lookup(raw: string): Promise<void> {
  const id = ++requestId;
  setBusy(true);
  hide(formError);
  hide(result);
  status.textContent = "Reading balances and recent USDC transfers from Base.";
  show(status);

  try {
    const snapshot = await readWallet(raw);
    if (id !== requestId) return;
    render(snapshot);
    hide(status);
    show(result);
  } catch (error) {
    if (id !== requestId) return;
    console.error(error);
    hide(status);
    formError.textContent = friendlyError(error);
    show(formError);
  } finally {
    if (id === requestId) setBusy(false);
  }
}

function render(snapshot: WalletSnapshot): void {
  resultAddress.textContent = snapshot.address;
  basescan.href = `https://basescan.org/address/${snapshot.address}`;
  asOf.textContent = `Balances at block ${formatBlock(snapshot.blockNumber)}.`;
  ethBalance.textContent = formatToken(snapshot.eth, ETH_DECIMALS);
  usdcBalance.textContent = formatToken(snapshot.usdc, USDC_DECIMALS);
  windowNote.textContent = snapshot.windowStartTime
    ? `USDC transfers since ${formatClock(snapshot.windowStartTime)}. A free public node can only search about the last five hours.`
    : "USDC transfers from the last few hours. A free public node does not keep older transfer search.";

  transferList.replaceChildren();
  if (snapshot.transfers.length === 0) {
    transferEmpty.textContent = emptyCopy(snapshot);
    show(transferEmpty);
    hide(transferList);
    return;
  }

  hide(transferEmpty);
  show(transferList);
  for (const transfer of snapshot.transfers) {
    transferList.append(renderTransfer(transfer));
  }
}

function renderTransfer(transfer: UsdcTransfer): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "transfer";

  const direction = document.createElement("span");
  direction.className = `dir ${transfer.direction}`;
  direction.textContent =
    transfer.direction === "in" ? "In" : transfer.direction === "out" ? "Out" : "Self";

  const amount = document.createElement("span");
  amount.className = "transfer-amount";
  amount.textContent = `${formatToken(transfer.amount, USDC_DECIMALS)} USDC`;

  const party = document.createElement("span");
  party.className = "party";
  const other = transfer.direction === "out" ? transfer.to : transfer.from;
  const relation =
    transfer.direction === "out" ? "to" : transfer.direction === "in" ? "from" : "with";
  party.textContent = `${relation} ${shortAddress(other)}`;

  const when = document.createElement("time");
  when.className = "when";
  if (transfer.timestamp) {
    when.dateTime = transfer.timestamp.toISOString();
    when.textContent = formatWhen(transfer.timestamp);
    when.title = formatClock(transfer.timestamp);
  } else {
    when.textContent = `block ${formatBlock(transfer.blockNumber)}`;
  }

  const link = document.createElement("a");
  link.href = `https://basescan.org/tx/${transfer.hash}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Transaction";

  item.append(direction, amount, party, when, link);
  return item;
}

function emptyCopy(snapshot: WalletSnapshot): string {
  const since = snapshot.windowStartTime
    ? `since ${formatClock(snapshot.windowStartTime)}`
    : "in the recent window";
  if (snapshot.eth === 0n && snapshot.usdc === 0n) {
    return `No ETH, no USDC, and no USDC transfers ${since}. This address is empty on Base.`;
  }
  return `No USDC transfers ${since}. The balances above are still current.`;
}

function friendlyError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("That is not an address")) {
    return error.message;
  }
  return "Base did not answer. Wait a few seconds and try again.";
}

function setBusy(busy: boolean): void {
  submit.disabled = busy;
  submit.textContent = busy ? "Looking up…" : "Look up";
  form.setAttribute("aria-busy", busy ? "true" : "false");
}

function show(element: HTMLElement): void {
  element.hidden = false;
}

function hide(element: HTMLElement): void {
  element.hidden = true;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
