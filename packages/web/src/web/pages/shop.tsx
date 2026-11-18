import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Store,
  Shapes,
  Gift,
  UserRound,
  ChevronRight,
  ArrowUpRight,
  Search,
  Coins,
  Sparkles,
  X,
  ArrowRight,
  Check,
  LogOut,
  LoaderCircle,
  SlidersHorizontal,
  Info,
  PackageOpen,
  Menu,
  MessageCircle,
  Users,
  Dices,
} from "lucide-react";
import { packs, characters, type Pack } from "../../shared/catalog";
import { CollectionCards } from "../components/collection-cards";
import { Creature, PackArt } from "../components/creature";
import { PackOpening } from "../components/pack-opening";
import { AuthDialog } from "../components/auth-dialog";
import { authClient } from "../lib/auth";
import { useGameState, useClaim } from "../queries/game";
import { CommunityChat } from "../components/community-chat";
import { useAccountStatus } from "../queries/moderation";
import { OwnerBadge } from "../components/moderation-panel";
import { Bazaar } from "../components/bazaar";
import { ModeratorBadge, StaffPanel } from "../components/staff-panel";
import { Casino } from "../components/casino";
import { Clans } from "../components/clans";
export default function Shop() {
  const [path] = useLocation();
  const section =
    path === "/collection"
      ? "collection"
      : path === "/rewards"
        ? "rewards"
        : path === "/profile"
          ? "profile"
          : path === "/chat"
            ? "chat"
            : path === "/bazaar"
              ? "bazaar"
              : path === "/clans"
                ? "clans"
                : path === "/casino"
                  ? "casino"
                  : "shop";
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const account = useAccountStatus(session?.user.id);
  const state = useGameState(!!session && !account.data?.banned, session?.user.id);
  const claim = useClaim();
  const [auth, setAuth] = useState(false);
  const [category, setCategory] = useState("All packs");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pack | null>(null);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [sort, setSort] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const profile = session ? state.data?.profile : undefined;
  const items = session ? (state.data?.items ?? []) : [];
  const balance = profile?.coins ?? 0;
  const claimed = !!profile && Date.now() - profile.lastClaim < 86400000;
  const filtered = packs
    .filter(
      (p) =>
        (category === "All packs" || p.category === category) &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => (sort ? a.price - b.price : 0));
  async function claimReward() {
    if (!session) return setAuth(true);
    try {
      await claim.mutateAsync(undefined);
      setNotice("250 coins added. Your next great find awaits!");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not claim reward.");
    }
  }
  function choose(p: Pack) {
    setSelected(p);
  }
  const nav = [
    { id: "shop", label: "Shop", icon: Store, href: "/" },
    { id: "collection", label: "My collection", icon: Shapes, href: "/collection" },
    { id: "bazaar", label: "Bazaar", icon: Store, href: "/bazaar" },
    { id: "clans", label: "Clans", icon: Users, href: "/clans" },
    { id: "casino", label: "Casino", icon: Dices, href: "/casino" },
    { id: "rewards", label: "Rewards", icon: Gift, href: "/rewards" },
    { id: "chat", label: "Community chat", icon: MessageCircle, href: "/chat" },
    { id: "profile", label: "Profile", icon: UserRound, href: "/profile" },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <Link href="/" className="wordmark">
          Sportlet<span>.</span>
        </Link>
        <div className="brand-caption">YOUR SPORTS. YOUR COLLECTION.</div>
        <span className="nav-label">YOUR PLAYGROUND</span>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={`nav-item ${section === n.id ? "active" : ""}`}
              onClick={() => setMobileNav(false)}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.id === "rewards" && !claimed && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <div className="promo-icon">
              <Sparkles size={20} />
            </div>
            <b>
              Your daily
              <br />
              head start.
            </b>
            <p>Your daily coins are on us.</p>
            <button onClick={claimReward} disabled={claimed || claim.isPending}>
              {claimed ? "Reward claimed" : "Claim daily reward"}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-foot">
            <span className="status-dot" />
            Made for the collectors.
          </div>
          <small>Sportlet © 2026 · An original fan project</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-button"
              aria-label="Toggle navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>Your playground</span>
            <ChevronRight size={14} />
            <b>{nav.find((n) => n.id === section)?.label}</b>
          </div>
          <div className="top-actions">
            <div className="balance">
              <Coins size={20} />
              <strong>{session && state.isLoading ? "…" : balance.toLocaleString()}</strong>
              <span>coins</span>
            </div>
            <span className="header-rule" />
            {sessionLoading ? (
              <LoaderCircle className="spin" size={18} />
            ) : session ? (
              <Link href="/profile" className="avatar" title={session.user.name}>
                {session.user.name.slice(0, 2).toUpperCase()}
              </Link>
            ) : (
              <button className="signin" onClick={() => setAuth(true)}>
                Sign in
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main className={section === "chat" ? "community-main" : undefined}>
          {account.data?.banned ? (
            <section className="reward-panel">
              <h2>This account is banned.</h2>
              <p>{account.data.banReason || "Account features have been disabled by the owner."}</p>
              <button className="secondary" onClick={() => authClient.signOut()}>
                <LogOut size={16} />
                Sign out
              </button>
            </section>
          ) : (
            <>
              {state.isError && (
                <div className="inline-error">
                  Could not load your saved progress. <span>{state.error.message}</span>{" "}
                  <button onClick={() => state.refetch()}>Try again</button>
                </div>
              )}
              {section === "shop" && (
                <>
                  <div className="page-title">
                    <div>
                      <div className="eyebrow">
                        <span />
                        THE COLLECTOR'S CORNER
                      </div>
                      <h1>
                        Your next legend awaits<span>.</span>
                      </h1>
                      <p>Five sports. Endless potential. Open packs and build your dream roster.</p>
                    </div>
                    <span className="season-tag">
                      <Sparkles size={14} /> FIVE SPORTS. ONE COLLECTION.
                    </span>
                  </div>
                  <div className="feature-row">
                    <section className="feature-banner">
                      <div className="banner-stars">
                        <span>✦</span>
                        <span>✧</span>
                        <span>+</span>
                        <span>✦</span>
                      </div>
                      <div className="feature-copy">
                        <span className="feature-label">
                          <span /> IN THE SPOTLIGHT
                        </span>
                        <h2>
                          Big game.
                          <br />
                          Bigger collection.
                        </h2>
                        <p>
                          Build your roster. Find your MVP.
                          <br />
                          The next legend is in your hands.
                        </p>
                        <button onClick={() => choose(packs[0]!)}>
                          Explore Basketball Pack
                          <ArrowRight size={17} />
                        </button>
                        <small>
                          {packs[0]!.names.length} PLAYERS TO DISCOVER <span>•</span> {packs[0]!.price} COINS EACH
                        </small>
                      </div>
                      <div className="hero-art">
                        <div className="planet-ring" />
                        <div className="floating-cap">
                          <Creature kind="basketball" color="#82dfaa" />
                        </div>
                        <div className="mini-ghost">
                          <Creature kind="soccer" color="#f2b15e" />
                        </div>
                        <div className="hero-coin">C</div>
                        <span className="hero-spark">✦</span>
                        <span className="orbit-label">YOUR NEXT RARE FIND?</span>
                      </div>
                    </section>
                    <section className="daily-card">
                      <div className="daily-top">
                        <span>YOUR DAILY BOOST</span>
                        <Gift size={18} />
                      </div>
                      <div className="coin-stack">
                        <div className="coin coin-back">C</div>
                        <div className="coin coin-front">C</div>
                        <span>✦</span>
                      </div>
                      <h3>Show up. Get rewarded.</h3>
                      <p>
                        250 coins. Every day.
                        <br />
                        Your next all-star starts here.
                      </p>
                      <button
                        className="primary"
                        onClick={claimReward}
                        disabled={claimed || claim.isPending}
                      >
                        {claim.isPending ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : claimed ? (
                          <>
                            <Check size={17} />
                            Reward claimed
                          </>
                        ) : (
                          <>
                            Claim 250 coins
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                      <small>
                        {claimed
                          ? "Come back 24 hours after your claim"
                          : "No catches. Just coins."}
                      </small>
                    </section>
                  </div>
                  <div className="shelf-heading">
                    <div>
                      <h2>
                        The pack shop <span>{packs.length}</span>
                      </h2>
                      <p>Pick your sport. Take your shot.</p>
                    </div>
                    <div className="shop-tools">
                      <label className="search-box">
                        <Search size={16} />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search packs…"
                          aria-label="Search packs"
                        />
                      </label>
                      <button
                        className={`sort-btn ${sort ? "active" : ""}`}
                        onClick={() => setSort(!sort)}
                        title={sort ? "Restore featured order" : "Sort by price"}
                        aria-label="Sort by price"
                      >
                        <SlidersHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="filters">
                    {[
                      "All packs",
                      "Basketball",
                      "Soccer",
                      "Football",
                      "Ice hockey",
                      "Baseball",
                    ].map((c) => (
                      <button
                        key={c}
                        className={category === c ? "active" : ""}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                    <span>
                      <Info size={13} /> Every pack contains 1 player card
                    </span>
                  </div>
                  <div className="pack-grid">
                    {filtered.map((p) => (
                      <article className="pack-card" key={p.id}>
                        <button
                          className="pack-display"
                          style={
                            {
                              "--pack-color": p.color,
                              "--pack-dark": p.dark,
                            } as React.CSSProperties
                          }
                          onClick={() => choose(p)}
                          aria-label={`View ${p.name}`}
                        >
                          <span className="card-tag">
                            {p.label || `${p.category.toUpperCase()} SERIES`}
                          </span>
                          <div className="art-rays" />
                          <PackArt pack={p} />
                          <span className="display-caption">{p.names.length} PLAYERS TO COLLECT</span>
                        </button>
                        <div className="pack-details">
                          <div className="pack-name">
                            <h3>{p.name}</h3>
                            <span className="price">
                              <Coins size={16} />
                              {p.price}
                            </span>
                          </div>
                          <p>{p.subtitle}</p>
                          <button onClick={() => choose(p)}>
                            Open pack
                            <ArrowUpRight size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="empty">
                      <Search />
                      <h3>No packs found</h3>
                      <p>Try a different name or category.</p>
                    </div>
                  )}
                  <div className="shop-footer">
                    <span>
                      <Shapes size={15} /> Build a roster. Collect greatness.
                    </span>
                    <span>Fictional athletes. Real collector energy.</span>
                  </div>
                </>
              )}
              {section === "collection" && (
                <>
                  <div className="page-title">
                    <div>
                      <div className="eyebrow">
                        <span />
                        YOUR DREAM ROSTER
                      </div>
                      <h1>
                        My collection<span>.</span>
                      </h1>
                      <p>
                        {items.length} of {characters.length} unique players discovered. Every
                        collection starts somewhere.
                      </p>
                    </div>
                  </div>
                  <div className="collection-progress">
                    <span>{Math.round((items.length / characters.length) * 100)}% discovered</span>
                    <div>
                      <i style={{ width: `${(items.length / characters.length) * 100}%` }} />
                    </div>
                  </div>
                  {!session && (
                    <div className="account-callout">
                      <Shapes />
                      <div>
                        <h3>Your dream team starts here.</h3>
                        <p>Sign in to start and save your collection. Get 500 coins to begin.</p>
                      </div>
                      <button className="primary" onClick={() => setAuth(true)}>
                        Create account
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  {state.isLoading ? (
                    <div className="empty">
                      <LoaderCircle className="spin" />
                      Loading your collection…
                    </div>
                  ) : (
                    <CollectionCards key={session?.user.id ?? "guest"} items={items} signedIn={!!session} />
                  )}
                </>
              )}
              {section === "rewards" && (
                <>
                  <div className="page-title">
                    <div>
                      <div className="eyebrow">
                        <span />
                        LITTLE REWARDS, EVERY DAY
                      </div>
                      <h1>
                        Keep the good finds coming<span>.</span>
                      </h1>
                      <p>No purchases. No pressure. Just more coins for your collection.</p>
                    </div>
                  </div>
                  <section className="reward-panel">
                    <div className="coin huge">C</div>
                    <span className="eyebrow">DAILY COLLECTOR REWARD</span>
                    <h2>250 coins, on the house.</h2>
                    <p>Claim once every 24 hours. Spend them on any pack in the shop.</p>
                    <button
                      className="primary"
                      onClick={claimReward}
                      disabled={claimed || claim.isPending}
                    >
                      {claim.isPending
                        ? "Claiming…"
                        : claimed
                          ? "Reward claimed — see you tomorrow"
                          : "Claim your daily coins"}
                      <Gift size={18} />
                    </button>
                    <small>Your balance: {balance.toLocaleString()} coins</small>
                  </section>
                  <div className="account-callout">
                    <Sparkles />
                    <div>
                      <h3>A warm welcome.</h3>
                      <p>Every new account gets 500 starter coins automatically.</p>
                    </div>
                    <Link href="/" className="text-link">
                      Explore the shop
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </>
              )}
              {section === "chat" && (
                <CommunityChat
                  user={session?.user}
                  sessionLoading={sessionLoading}
                  signIn={() => setAuth(true)}
                />
              )}
              {section === "bazaar" && <Bazaar key={session?.user.id ?? "guest"} userId={session?.user.id} items={items} balance={balance} loading={sessionLoading || (!!session && state.isLoading)} signIn={() => setAuth(true)} />}
              {section === "clans" && <Clans key={session?.user.id ?? "guest"} userId={session?.user.id} loading={sessionLoading} signIn={() => setAuth(true)} />}
              {section === "casino" && <Casino key={session?.user.id ?? "guest"} userId={session?.user.id} coins={balance} loading={sessionLoading || (!!session && state.isLoading)} signIn={() => setAuth(true)} />}
              {section === "profile" && (
                <>
                  <div className="page-title">
                    <div>
                      <div className="eyebrow">
                        <span />
                        THE COLLECTOR BEHIND THE PLAYERS
                      </div>
                      <h1>
                        Your profile<span>.</span>
                      </h1>
                      <p>A collection as unique as you are.</p>
                    </div>
                  </div>
                  {session ? (
                    <section className="profile-panel">
                      <div className="avatar large">
                        {session.user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <h2>{session.user.name}</h2>
                      {account.data?.role === "owner" && <OwnerBadge />}
                      {account.data?.role === "moderator" && <ModeratorBadge />}
                      <p>{session.user.email}</p>
                      <div className="profile-stats">
                        <div>
                          <Coins />
                          <strong>{balance}</strong>
                          <span>Coins</span>
                        </div>
                        <div>
                          <Shapes />
                          <strong>{items.length}</strong>
                          <span>Unique players</span>
                        </div>
                        <div>
                          <PackageOpen />
                          <strong>{profile?.opened ?? 0}</strong>
                          <span>Packs opened</span>
                        </div>
                      </div>
                      <p className="saved-note">
                        <Check size={15} /> Your progress is saved to your account.
                      </p>
                      {(account.data?.role === "owner" || account.data?.role === "moderator") && <button className="secondary profile-staff-button" onClick={() => setStaffOpen(true)}>Manage players</button>}
                      <button
                        className="secondary"
                        onClick={async () => {
                          await authClient.signOut();
                          setNotice("Signed out. Your collection is safely saved.");
                        }}
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </section>
                  ) : (
                    <section className="reward-panel">
                      <UserRound size={46} />
                      <h2>Your collection starts with you.</h2>
                      <p>Create an account to keep your coins and players safe.</p>
                      <button className="primary" onClick={() => setAuth(true)}>
                        Sign in or create account
                        <ArrowRight size={17} />
                      </button>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {notice && (
        <output className="toast">
          <Info size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </output>
      )}
      {selected && (
        <PackOpening pack={selected} balance={balance} signedIn={!!session}
          loading={state.isLoading} loadError={state.isError}
          signIn={() => setAuth(true)} close={() => setSelected(null)} />
      )}
      {auth && <AuthDialog close={() => setAuth(false)} />}
      {staffOpen && session && (account.data?.role === "owner" || account.data?.role === "moderator") && <StaffPanel userId={session.user.id} role={account.data.role} close={() => setStaffOpen(false)} />}
    </div>
  );
}
