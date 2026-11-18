import { useState } from "react";
import { Coins, LoaderCircle, X } from "lucide-react";
import { characters, packs, rarities } from "../../shared/catalog";
import { Creature } from "./creature";
import { Dialog } from "./dialog";
import { useSell } from "../queries/game";

type Item = { characterId: string; quantity: number };
type Sale = { characterId: string; quantity: number };
export function CollectionCards({ items, signedIn }: { items: Item[]; signedIn: boolean }) {
  const sell = useSell();
  const [mass, setMass] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Sale[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = Object.entries(selection).map(([characterId, quantity]) => ({ characterId, quantity: Number(quantity) }));
  const valid = selected.length > 0 && selected.every((sale) => Number.isInteger(sale.quantity) && sale.quantity > 0 && sale.quantity <= (items.find((item) => item.characterId === sale.characterId)?.quantity ?? 0));
  const total = (sales: Sale[]) => sales.reduce((sum, sale) => sum + sale.quantity * (characters.find((c) => c.id === sale.characterId)?.sellValue ?? 0), 0);
  function review(sales: Sale[]) { setPending(sales); setError(""); sell.reset(); }
  function selectMany(duplicates: boolean) {
    setSelection(Object.fromEntries(items.filter((item) => item.quantity > (duplicates ? 1 : 0))
      .map((item) => [item.characterId, String(item.quantity - (duplicates ? 1 : 0))])));
  }
  async function confirmSale() {
    if (!pending || sell.isPending) return;
    try {
      const result = await sell.mutateAsync({ items: pending });
      setNotice(`Sold ${result.sold} ${result.sold === 1 ? "card" : "cards"} for ${result.earned.toLocaleString()} coins.`);
      setPending(null); setSelection({}); setMass(false); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't sell these cards."); }
  }
  return <>
    {signedIn && <section className="sell-tools" aria-label="Collection selling tools">
      <div className="sell-tools-heading"><div><h3>Turn cards into coins.</h3><p>Sell one card or choose multiple copies.</p></div>
        <button className="secondary" disabled={!items.length || sell.isPending} onClick={() => { setMass(!mass); setSelection({}); }}>{mass ? "Cancel selection" : "Mass sell"}</button>
      </div>
      <div className="sell-values">{rarities.map((r) => <span key={r.name}><b style={{ color: r.color }}>{r.name}</b> {r.sellValue} coins</span>)}</div>
      {mass && <>
        <div className="sell-select-tools">
          <button className="secondary" onClick={() => selectMany(true)}>Select duplicates</button>
          <button className="secondary" onClick={() => selectMany(false)}>Select all</button>
          <button className="secondary" onClick={() => setSelection({})}>Clear</button>
        </div>
        <p>Duplicates keeps one copy of every player. Select all includes your last copies.</p>

      </>}
    </section>}
    {notice && <output className="sale-notice">{notice}</output>}
    <div className="collection-grid">
      {characters.map((c) => {
        const item = items.find((i) => i.characterId === c.id);
        const checked = selection[c.id] !== undefined;
        return <article key={c.id} className={`collection-card ${item ? "owned" : "locked"} ${mass && checked ? "sale-selected" : ""}`}>
          <Creature kind={c.kind} color={c.color} number={c.number} />
          {item && <b className="rating-badge">{c.rating}<small>OVR</small></b>}
          <h3>{item ? c.name : "Undiscovered"}</h3>
          <span style={{ color: c.rarityColor }}>{c.rarity}</span>
          <small>{item && <>{c.position}<br /></>}{item ? `Owned ×${item.quantity}` : packs.find((p) => p.id === c.packId)?.name}</small>
          {item && signedIn && (mass ? <div className="card-sale-controls">
            <label><input type="checkbox" aria-label={`Select ${c.name}`} checked={checked} onChange={(event) => {
              setSelection((current) => { const next = { ...current }; if (event.target.checked) next[c.id] = "1"; else delete next[c.id]; return next; });
            }} /> Sell copies</label>
            {checked && <input aria-label={`Copies of ${c.name} to sell`} type="number" min={1} max={item.quantity} step={1}
              value={selection[c.id]} onChange={(event) => setSelection((current) => ({ ...current, [c.id]: event.target.value }))} />}
          </div> : <button className="sell-card-button" disabled={sell.isPending} onClick={() => review([{ characterId: c.id, quantity: 1 }])} aria-label={`Sell one ${c.name} for ${c.sellValue} coins`}>
            Sell one · {c.sellValue} <Coins size={13} />
          </button>)}
        </article>;
      })}
    </div>
    {mass && <div className="sell-selection-summary"><span>{valid ? `${selected.reduce((sum, sale) => sum + sale.quantity, 0)} cards · ${total(selected).toLocaleString()} coins` : selected.length ? "Check the selected quantities" : "Choose cards below"}</span>
          <button className="primary" disabled={!valid || sell.isPending} onClick={() => review(selected)}>Review sale</button></div>}
    {pending && <Dialog className="batch-modal sell-modal" label="Confirm card sale" close={() => setPending(null)} busy={sell.isPending}>
      <header className="batch-header"><span className="eyebrow">REVIEW YOUR SALE</span><h2>Sell {pending.reduce((sum, sale) => sum + sale.quantity, 0)} cards?</h2>
        <button className="close" disabled={sell.isPending} onClick={() => setPending(null)} aria-label="Cancel sale"><X size={20} /></button>
      </header>
      <div className="batch-body"><p>These copies will leave your collection. Selling your last copy makes that player undiscovered again.</p>
        <ul className="sale-review-list">{pending.map((sale) => {
          const c = characters.find((character) => character.id === sale.characterId)!;
          return <li key={sale.characterId}><div><strong>{c.name} ×{sale.quantity}</strong><small>{c.rarity} · {c.sellValue} coins each</small></div><b>+{(c.sellValue * sale.quantity).toLocaleString()}</b></li>;
        })}</ul>
      </div>
      <footer className="batch-actions"><strong className="sale-total">You receive {total(pending).toLocaleString()} coins</strong>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={sell.isPending} onClick={confirmSale}>{sell.isPending ? <><LoaderCircle className="spin" size={18} />Selling…</> : <>Confirm sale · +{total(pending).toLocaleString()} coins <Coins size={18} /></>}</button>
        <button className="text-link sale-cancel" disabled={sell.isPending} onClick={() => setPending(null)}>Keep my cards</button>
      </footer>
    </Dialog>}
  </>;
}