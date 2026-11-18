import { useState } from "react";
import { Coins, Plus, Search, Store, X } from "lucide-react";
import { characters, packs } from "../../shared/catalog";
import { useBazaar, useBazaarActions, useMyListings } from "../queries/bazaar";
import { Creature } from "./creature";
import { Dialog } from "./dialog";
import "../styles/bazaar.css";

type Listing = { id: number; sellerId: string; sellerName?: string; characterId: string; quantity: number; price: number; status?: string };
export function Bazaar({ userId, items, balance, signIn, loading = false }: {
  userId?: string; items: { characterId: string; quantity: number }[]; balance: number; signIn: () => void; loading?: boolean;
}) {
  const listings = useBazaar();
  const mine = useMyListings(userId);
  const { create, buy, cancel } = useBazaarActions();
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [rarity, setRarity] = useState("");
  const [dialog, setDialog] = useState<"create" | "buy" | "cancel" | null>(null);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [cardId, setCardId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(25);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = create.isPending || buy.isPending || cancel.isPending;
  const chosenCardId = cardId || items[0]?.characterId || "";
  const available = items.find((item) => item.characterId === chosenCardId)?.quantity ?? 0;
  const rows: Listing[] = tab === "mine" ? (mine.data ?? []) : (listings.data?.pages.flatMap((page) => page.listings) ?? []);
  const filtered = rows.filter((listing) => {
    const card = characters.find((item) => item.id === listing.characterId);
    return card && (!sport || card.kind === sport) && (!rarity || card.rarity === rarity)
      && `${card.name} ${listing.sellerName ?? ""}`.toLowerCase().includes(search.toLowerCase());
  });
  function open(kind: "create" | "buy" | "cancel", listing?: Listing) {
    if (!userId) return signIn();
    setError(""); setSelected(listing ?? null); setDialog(kind);
    if (kind === "create") { setCardId(items[0]?.characterId ?? ""); setQuantity(1); setPrice(25); }
  }
  async function confirm() {
    setError("");
    try {
      if (dialog === "create") {
        await create.mutateAsync({ characterId: chosenCardId, quantity, price });
        setNotice("Listing is live. Your cards are held safely until bought or cancelled.");
      } else if (dialog === "buy" && selected) {
        await buy.mutateAsync({ id: selected.id }); setNotice(`${selected.quantity} card(s) added to your collection.`);
      } else if (dialog === "cancel" && selected) {
        await cancel.mutateAsync({ id: selected.id }); setNotice("Listing cancelled. Cards returned to your collection.");
      }
      setDialog(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed. Try again."); }
  }
  const valid = dialog === "create" ? !!chosenCardId && Number.isInteger(quantity) && quantity >= 1 && quantity <= Math.min(available, 1000)
    && Number.isInteger(price) && price >= 1 && price <= 1000000 : dialog !== "buy" || balance >= (selected ? selected.price * selected.quantity : Infinity);
  const pending = tab === "mine" ? mine.isLoading : listings.isLoading;
  const queryError = tab === "mine" ? mine.error : listings.error;
  return <section className="bazaar-page">
    <div className="page-title"><div><div className="eyebrow"><span />THE COLLECTOR EXCHANGE</div>
      <h1>The bazaar<span>.</span></h1><p>Your players. Your prices. Trade cards with other collectors using coins.</p></div>
      <button className="secondary" disabled={loading} onClick={() => open("create")}><Plus size={17} />{loading ? "Loading collection…" : "List cards"}</button>
    </div>
    <div className="bazaar-intro"><Store size={24} /><div><b>Collector to collector. Zero fees.</b><p>Prices are per copy. Buy the whole listing; every coin goes to the seller. Listed cards leave your collection until sold or cancelled.</p></div></div>
    {notice && <output className="bazaar-notice">{notice}<button aria-label="Dismiss bazaar message" onClick={() => setNotice("")}><X size={16} /></button></output>}
    <div className="bazaar-toolbar"><div className="filters"><button className={tab === "browse" ? "active" : ""} onClick={() => setTab("browse")}>Browse listings</button>
      <button className={tab === "mine" ? "active" : ""} disabled={loading} onClick={() => userId ? setTab("mine") : signIn()}>My listings</button></div>
      <label className="search-box"><Search size={16} /><input aria-label="Search bazaar" placeholder="Player or seller…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <select aria-label="Filter bazaar sport" value={sport} onChange={(e) => setSport(e.target.value)}><option value="">All sports</option>{packs.map((pack) => <option value={pack.id} key={pack.id}>{pack.category}</option>)}</select>
      <select aria-label="Filter bazaar rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="">All rarities</option>{["Rookie", "Starter", "All-Star", "MVP", "Legend"].map((r) => <option key={r}>{r}</option>)}</select>
    </div>
    {pending ? <div className="empty">Loading listings…</div> : queryError ? <div className="inline-error">{queryError.message}<button onClick={() => tab === "mine" ? mine.refetch() : listings.refetch()}>Try again</button></div> : <>
      <div className="bazaar-grid">{filtered.map((listing) => {
        const card = characters.find((item) => item.id === listing.characterId)!;
        const own = listing.sellerId === userId;
        const active = !listing.status || listing.status === "active";
        return <article className="bazaar-card" key={listing.id}>
          <div className="bazaar-art" style={{ background: `${card.rarityColor}15` }}><span style={{ color: card.rarityColor }}>{card.rarity}</span><Creature kind={card.kind} color={card.rarityColor} /><b>×{listing.quantity}</b></div>
          <div className="bazaar-card-info"><h3>{card.name}</h3><p>{card.position} · {card.rating} OVR</p><p className="bazaar-seller">{own ? "Your listing" : `Listed by ${listing.sellerName}`}</p>
            <div className="bazaar-price"><Coins size={17} /><strong>{listing.price.toLocaleString()}</strong><span>/ copy</span></div>
            <small>{(listing.price * listing.quantity).toLocaleString()} coins total · {listing.quantity} {listing.quantity === 1 ? "copy" : "copies"}</small>
            {active ? <button className="secondary" disabled={loading} onClick={() => open(own ? "cancel" : "buy", listing)}>{own ? "Cancel listing" : "Buy listing"}</button> : <div className="bazaar-status">{listing.status === "reset" ? "Discarded by progress reset" : listing.status}</div>}
          </div>
        </article>;
      })}</div>
      {!filtered.length && <div className="empty"><Store /><h3>{tab === "mine" ? "No listings yet" : "No matching listings"}</h3><p>{tab === "mine" ? "List cards from your collection to get started." : "Try another filter, or be the first to list a player."}</p></div>}
      {tab === "browse" && listings.hasNextPage && <button className="secondary" disabled={listings.isFetchingNextPage} onClick={() => listings.fetchNextPage()}>{listings.isFetchingNextPage ? "Loading…" : "Load more listings"}</button>}
      {tab === "mine" && <p className="bazaar-footnote">Showing your latest 100 listings. Up to 50 can be active.</p>}
    </>}
    {dialog && <Dialog label={dialog === "create" ? "List cards in the bazaar" : dialog === "buy" ? "Confirm bazaar purchase" : "Cancel bazaar listing"} className="batch-modal bazaar-modal" busy={busy} close={() => setDialog(null)}>
      <header className="bazaar-modal-head"><div><span className="eyebrow">BAZAAR</span><h2>{dialog === "create" ? "Set your price." : dialog === "buy" ? "Make it yours." : "Return your cards."}</h2></div><button aria-label="Close bazaar dialog" disabled={busy} onClick={() => setDialog(null)}><X size={20} /></button></header>
      <div className="bazaar-modal-body">
        {dialog === "create" ? items.length ? <><label>Player card<select aria-label="Player card" value={chosenCardId} onChange={(e) => { setCardId(e.target.value); setQuantity(1); }}>{items.map((item) => <option key={item.characterId} value={item.characterId}>{characters.find((c) => c.id === item.characterId)?.name} · {item.quantity} available</option>)}</select></label>
          <div className="bazaar-form-row"><label>Copies<input aria-label="Copies to list" type="number" min={1} max={Math.min(available, 1000)} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label><label>Coins per copy<input aria-label="Coins per copy" type="number" min={1} max={1000000} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label></div>
          <div className="bazaar-summary"><b>{(price * quantity).toLocaleString()} coins total</b><p>Buyers purchase all {quantity} copies together. No listing fee.</p></div><p>These copies will leave your collection now. Cancel an unsold listing to get them back.</p></> : <div className="empty"><h3>No available cards</h3><p>Open packs first, or cancel one of your active listings.</p></div>
          : selected && <><h3>{characters.find((c) => c.id === selected.characterId)?.name} ×{selected.quantity}</h3><div className="bazaar-summary"><b>{(selected.price * selected.quantity).toLocaleString()} coins total</b><p>{selected.price.toLocaleString()} per copy</p></div><p>{dialog === "buy" ? `Your balance: ${balance.toLocaleString()} coins. All copies will be added to your collection and the seller receives the full price.` : "The listing will be removed and all unsold copies returned to your collection. No coins change hands."}</p>{dialog === "buy" && !valid && <p className="inline-error">Not enough coins for this listing.</p>}</>}
        {error && <div className="inline-error" role="alert">{error}</div>}
      </div>
      <footer className="bazaar-modal-foot"><button className="secondary" disabled={busy} onClick={() => setDialog(null)}>Go back</button><button className="primary" disabled={busy || !valid} onClick={confirm}>{busy ? "Working…" : dialog === "create" ? "Confirm listing" : dialog === "buy" ? "Confirm purchase" : "Confirm cancellation"}</button></footer>
    </Dialog>}
  </section>;
}