import { useRef, useState } from "react";
import { ArrowLeftRight, Coins, Dices, X } from "lucide-react";
import { useCasinoActions, useCasinoState } from "../queries/casino";
import { Dialog } from "./dialog";
import { redNumbers, slotSymbols } from "../../shared/casino-rules";
import "../styles/expansion.css";
export function Casino({
  userId,
  coins,
  signIn,
  loading,
}: {
  userId?: string;
  coins: number;
  signIn: () => void;
  loading: boolean;
}) {
  const state = useCasinoState(userId);
  const { exchange, play } = useCasinoActions();
  const [game, setGame] = useState<"roulette" | "slots" | "coinflip">("roulette");
  const [choice, setChoice] = useState("red");
  const [bet, setBet] = useState(10);
  const [amount, setAmount] = useState(100);
  const [direction, setDirection] = useState<"toChips" | "toCoins">("toChips");
  const [confirmation, setConfirmation] = useState<{
    direction: "toChips" | "toCoins";
    amount: number;
    requestId: string;
  } | null>(null);
  const [result, setResult] = useState<{
    result: string;
    multiplier: number;
    payout: number;
    bet: number;
    game: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const chips = state.data?.chips ?? 0;
  const busy = exchange.isPending || play.isPending;
  const ready = !loading && !state.isLoading && !state.isError;
  const validBet = Number.isInteger(bet) && bet >= 1 && bet <= 100000 && bet <= chips;
  const validExchange =
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= 100000 &&
    amount <= (direction === "toChips" ? coins : chips);
  async function wager() {
    if (!userId) return signIn();
    setError("");
    setNotice("");
    const signature = JSON.stringify({ game, bet, choice });
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    const requestId = retry.current!.id;
    try {
      const outcome = await play.mutateAsync(
        game === "slots"
          ? { game, bet, requestId }
          : game === "coinflip"
            ? { game, bet, requestId, choice: choice as "heads" | "tails" }
            : { game, bet, requestId, choice },
      );
      setResult({ ...outcome, game, bet });
      retry.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Play could not be confirmed. Retry to safely check the same wager.",
      );
    }
  }
  async function confirmExchange() {
    if (!confirmation) return;
    setError("");
    try {
      await exchange.mutateAsync(confirmation);
      setNotice(
        `Exchanged ${confirmation.amount.toLocaleString()} ${confirmation.direction === "toChips" ? "coins for chips" : "chips for coins"}.`,
      );
      setConfirmation(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exchange failed. Retry safely.");
    }
  }
  function selectGame(next: typeof game) {
    setGame(next);
    setChoice(next === "coinflip" ? "heads" : "red");
    setError("");
    setResult(null);
  }
  const rouletteNumber = result?.game === "roulette" ? Number(result.result) : undefined;
  return (
    <section className="casino-page">
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <span />
            THE VIRTUAL GAME ROOM
          </div>
          <h1>
            Take a chance<span>.</span>
          </h1>
          <p>Roulette, slots and coin flip. Play with saved chips, on your terms.</p>
        </div>
      </div>
      <div className="casino-wallet">
        <div>
          <span>YOUR SAVED CHIPS</span>
          <strong>
            {state.isLoading ? "…" : chips.toLocaleString()} <Dices size={24} />
          </strong>
          <p>1 chip = 1 Sportlet coin. Keep your chips here as long as you like.</p>
        </div>
        <div>
          <span>SPORTLET COINS</span>
          <strong>
            {coins.toLocaleString()} <Coins size={22} />
          </strong>
          <p>Virtual currency only. No real-money deposits or cash-outs.</p>
        </div>
      </div>
      {!userId && (
        <div className="exp-callout">
          <p>Sign in to exchange coins, play and save your chips.</p>
          <button className="secondary" onClick={signIn}>
            Sign in to play
          </button>
        </div>
      )}
      {state.isError && (
        <div className="inline-error">
          {state.error.message}
          <button onClick={() => state.refetch()}>Try again</button>
        </div>
      )}
      {notice && <output className="exp-notice">{notice}</output>}
      <div className="casino-layout">
        <div className="casino-table">
          <div className="exp-tabs">
            {(["roulette", "slots", "coinflip"] as const).map((kind) => (
              <button
                key={kind}
                disabled={busy}
                className={game === kind ? "active" : ""}
                onClick={() => selectGame(kind)}
              >
                {kind === "coinflip" ? "Coin flip" : kind === "slots" ? "Slots" : "Roulette"}
              </button>
            ))}
          </div>
          <div
            className={`casino-stage ${play.isPending ? "casino-playing" : ""}`}
            aria-live="polite"
          >
            {game === "roulette" ? (
              <div className="roulette-wheel">
                <div
                  className={`roulette-ball ${rouletteNumber === 0 ? "green" : rouletteNumber !== undefined && redNumbers.includes(rouletteNumber) ? "red" : "black"}`}
                >
                  {play.isPending ? "…" : (rouletteNumber ?? "0–36")}
                </div>
                <small>SINGLE ZERO · 37 POCKETS</small>
              </div>
            ) : game === "coinflip" ? (
              <div className="flip-coin">
                {play.isPending
                  ? "?"
                  : result?.game === "coinflip"
                    ? result.result === "heads"
                      ? "H"
                      : "T"
                    : "H / T"}
              </div>
            ) : (
              <div className="slot-reels">
                {(result?.game === "slots"
                  ? result.result.split(" · ")
                  : ["Ball", "Star", "Seven"]
                ).map((name, i) => (
                  <div key={i}>
                    <b>{play.isPending ? "?" : slotSymbols.find((s) => s.name === name)?.mark}</b>
                    <span>{play.isPending ? "Spinning" : name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {result && result.game === game && (
            <output className={`casino-result ${result.payout > result.bet ? "win" : ""}`}>
              <b>{result.result}</b>
              <span>
                {result.payout > result.bet
                  ? "Win"
                  : result.payout === result.bet
                    ? "Stake returned"
                    : "No win"}{" "}
                · returned {result.payout.toLocaleString()} chips · net{" "}
                {(result.payout - result.bet > 0 ? "+" : "") +
                  (result.payout - result.bet).toLocaleString()}
              </span>
            </output>
          )}
          <div className="casino-controls">
            {game !== "slots" && (
              <label>
                Your pick
                <select
                  aria-label="Casino pick"
                  disabled={busy}
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  {game === "coinflip" ? (
                    <>
                      <option value="heads">Heads</option>
                      <option value="tails">Tails</option>
                    </>
                  ) : (
                    <>
                      <option value="red">Red</option>
                      <option value="black">Black</option>
                      <option value="odd">Odd</option>
                      <option value="even">Even</option>
                      {Array.from({ length: 37 }, (_, i) => (
                        <option key={i} value={`number:${i}`}>
                          Number {i}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
            )}
            <label>
              Bet in chips
              <input
                aria-label="Bet in chips"
                disabled={busy}
                type="number"
                min={1}
                max={100000}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
              />
            </label>
            <button
              className="primary"
              disabled={busy || !ready || (!!userId && !validBet)}
              onClick={wager}
            >
              {play.isPending
                ? "Playing…"
                : `Bet ${Number.isFinite(bet) ? bet.toLocaleString() : ""} chips`}
            </button>
          </div>
          <p className="exp-hint">
            Bet 1–100,000 chips. Each click places one wager. No automatic play. Wait 2 seconds
            between plays.
          </p>
          {userId && !validBet && (
            <p className="exp-hint">Enter a whole-number bet within your chip balance.</p>
          )}
          {error && !confirmation && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <div className="casino-rules">
            <h3>Know the rules.</h3>
            {game === "roulette" ? (
              <p>
                Each number has a 1/37 chance. Red, black, odd or even: 18/37 chance, 2× total
                return. Straight number: 36× total return. Zero loses all outside bets. Theoretical
                return: 97.30%.
              </p>
            ) : game === "coinflip" ? (
              <p>
                Heads and tails each have a 50% chance. A correct pick returns 2× your bet; an
                incorrect pick returns nothing. Theoretical return: 100%.
              </p>
            ) : (
              <>
                <p>
                  Three independent reels, five equally likely symbols (20% each). Any pair returns
                  your stake (1×); three matching symbols pay the multiplier below. Otherwise
                  nothing is returned. Theoretical return: 88%.
                </p>
                <div className="slot-paytable">
                  {slotSymbols.map((symbol) => (
                    <span key={symbol.name}>
                      {symbol.mark} {symbol.name}: {symbol.multiplier}×
                    </span>
                  ))}
                </div>
              </>
            )}
            <small>
              All multipliers include your original stake. Outcomes are generated on the server.
              Past results do not affect the next play; winnings are never guaranteed.
            </small>
          </div>
        </div>
        <aside className="casino-exchange">
          <div className="exp-icon">
            <ArrowLeftRight size={24} />
          </div>
          <h2>Coins ↔ chips.</h2>
          <p>
            Exchange now or keep your chips for later. No fee. Your balance stays saved when you
            leave.
          </p>
          <label>
            Exchange direction
            <select
              aria-label="Exchange direction"
              value={direction}
              disabled={busy}
              onChange={(e) => setDirection(e.target.value as typeof direction)}
            >
              <option value="toChips">Coins → chips</option>
              <option value="toCoins">Chips → coins</option>
            </select>
          </label>
          <label>
            Amount
            <input
              aria-label="Exchange amount"
              value={amount}
              type="number"
              min={1}
              max={100000}
              disabled={busy}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button
            className="secondary"
            disabled={busy || !ready || (!!userId && !validExchange)}
            onClick={() =>
              userId
                ? (setError(""),
                  setConfirmation({ direction, amount, requestId: crypto.randomUUID() }))
                : signIn()
            }
          >
            Review exchange
          </button>
          <small>
            1–100,000 per exchange. Use only coins you want to risk; losses reduce your chips.
          </small>
        </aside>
      </div>
      {userId && (
        <section className="casino-history">
          <h2>Your recent activity</h2>
          <p>Latest 100 exchanges and plays. Chips remain saved even if you close this tab.</p>
          {state.isLoading ? (
            <p>Loading history…</p>
          ) : !state.data?.history.length ? (
            <p>No activity yet.</p>
          ) : (
            <div>
              {state.data.history.map((event) => {
                const isExchange = event.kind === "toChips" || event.kind === "toCoins";
                const outcome = JSON.parse(event.outcome) as { result?: string };
                return (
                  <article key={event.id}>
                    <div>
                      <b>
                        {isExchange
                          ? event.kind === "toChips"
                            ? "Coins → chips"
                            : "Chips → coins"
                          : event.kind === "coinflip"
                            ? "Coin flip"
                            : event.kind}
                      </b>
                      <small>
                        {new Date(event.createdAt).toLocaleString()}
                        {outcome.result ? ` · ${outcome.result}` : ""}
                      </small>
                    </div>
                    <div>
                      <b>
                        {isExchange
                          ? event.amount.toLocaleString()
                          : `${event.amount.toLocaleString()} bet / ${event.payout.toLocaleString()} returned`}
                      </b>
                      <small>{event.chips.toLocaleString()} chips after</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {confirmation && (
        <Dialog
          label="Confirm chip exchange"
          className="batch-modal exp-modal"
          busy={exchange.isPending}
          close={() => setConfirmation(null)}
        >
          <header>
            <h2>Confirm exchange.</h2>
            <button
              aria-label="Close exchange"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              <X size={20} />
            </button>
          </header>
          <div className="exp-modal-body">
            <p>
              Exchange{" "}
              <b>
                {confirmation.amount.toLocaleString()}{" "}
                {confirmation.direction === "toChips" ? "coins" : "chips"}
              </b>{" "}
              for the same number of {confirmation.direction === "toChips" ? "chips" : "coins"}. No
              fee.
            </p>
            <p>These are virtual game balances, not real money. Unexchanged chips stay saved.</p>
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <footer>
            <button className="secondary" disabled={busy} onClick={() => setConfirmation(null)}>
              Go back
            </button>
            <button className="primary" disabled={busy} onClick={confirmExchange}>
              {exchange.isPending ? "Exchanging…" : "Confirm exchange"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
