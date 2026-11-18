import { useState } from "react";
import { Link } from "wouter";
import { Coins, LoaderCircle, PackageOpen, X } from "lucide-react";
import { type Pack, rarities } from "../../shared/catalog";
import { useOpenMany } from "../queries/game";
import { Dialog } from "./dialog";
import { Creature, PackArt } from "./creature";

export function PackOpening({ pack, balance, signedIn, loading, loadError, signIn, close }: {
  pack: Pack; balance: number; signedIn: boolean; loading: boolean; loadError: boolean;
  signIn: () => void; close: () => void;
}) {
  const open = useOpenMany();
  const [quantity, setQuantity] = useState("1");
  const count = Number(quantity);
  const valid = Number.isInteger(count) && count >= 1 && count <= 100;
  const cost = valid ? count * pack.price : 0;
  const affordable = Math.min(100, Math.floor(balance / pack.price));
  const result = open.data;
  async function purchase() {
    if (!signedIn) return signIn();
    if (!valid || open.isPending) return;
    try { await open.mutateAsync({ packId: pack.id, quantity: count }); } catch { /* shown inline */ }
  }
  return (
    <Dialog className="pack-modal batch-modal" label={result ? "Your pack results" : pack.name}
      close={close} busy={open.isPending}>
      <header className="batch-header">
        <span className="eyebrow">{result ? "ADDED TO YOUR COLLECTION" : "SINGLE OR MASS OPEN"}</span>
        <h2>{result ? `${result.quantity} ${result.quantity === 1 ? "pack" : "packs"} opened` : pack.name}</h2>
        <button className="close" onClick={close} disabled={open.isPending} aria-label="Close pack"><X size={20} /></button>
      </header>
      <div className="batch-body" key={result ? "results" : "preview"}>
        {result ? <>
          <p>{result.results.filter((pull) => pull.isNew).length} new players · {result.cost} coins spent</p>
          <div className="batch-results">
            {result.results.map((pull, index) => <article className="batch-card" key={index}
              style={{ "--pull-color": pull.character.rarityColor } as React.CSSProperties}>
              <span className="batch-card-rating">{pull.character.rating} OVR</span>
              <Creature kind={pull.character.kind} color={pull.character.color} number={pull.character.number} />
              <strong>{pull.character.name}</strong>
              <span>{pull.character.rarity} · {pull.isNew ? "NEW" : "DUPLICATE"}</span>
              <small>{pull.character.position} · #{pull.character.number}</small>
            </article>)}
          </div>
        </> : <>
          <div className={`batch-preview ${open.isPending ? "opening" : ""}`}><PackArt pack={pack} /></div>
          <p>{pack.price} coins each · 1 player per pack · same odds on every pull</p>
          <div className="odds">{rarities.map((rarity) => <div key={rarity.name}>
            <span style={{ color: rarity.color }}>{rarity.name}</span><b>{rarity.chance}%</b>
          </div>)}</div>
        </>}
      </div>
      <footer className="batch-actions">
        {result ? <>
          <p>Your balance: {balance.toLocaleString()} coins</p>
          <button className="primary" onClick={() => open.reset()}>Choose more packs <PackageOpen size={18} /></button>
          <Link href="/collection" className="text-link" onClick={close}>View my collection</Link>
        </> : <>
          <div className="batch-quantity">
            <label htmlFor="pack-quantity">Packs to open</label>
            <input id="pack-quantity" aria-label="Packs to open" type="number" min={1} max={100} step={1}
              value={quantity} disabled={open.isPending} onChange={(event) => setQuantity(event.target.value)} />
            <div className="batch-presets">{[1, 5, 10].map((n) => <button key={n} disabled={open.isPending}
              className={count === n ? "active" : ""} onClick={() => setQuantity(String(n))}>{n}</button>)}
              <button disabled={open.isPending || !signedIn || affordable < 1} onClick={() => setQuantity(String(affordable))}>Max</button>
            </div>
          </div>
          {!valid && <p className="error" role="alert">Choose a whole number from 1 to 100.</p>}
          {open.isError && <p className="error" role="alert">{open.error.message}</p>}
          <button className="primary" disabled={open.isPending || !valid || loading || loadError || (signedIn && balance < cost)} onClick={purchase}>
            {open.isPending ? <><LoaderCircle className="spin" size={18} />Opening {count}…</> : <>
              {!signedIn ? "Sign in to open" : balance < cost ? "Not enough coins" : `Open ${count} ${count === 1 ? "pack" : "packs"} · ${cost} coins`}
              <PackageOpen size={18} />
            </>}
          </button>
          <small><Coins size={12} />{signedIn ? `Balance: ${balance.toLocaleString()} coins · Up to 100 at once` : "New accounts get 500 free coins"}</small>
        </>}
      </footer>
    </Dialog>
  );
}