import type { CreatureKind, Pack } from "../../shared/catalog";
export function Creature({
  kind = "basketball",
  color = "#f9a15c",
  className = "",
  number,
}: {
  kind?: CreatureKind;
  color?: string;
  className?: string;
  number?: number;
}) {
  const skin = kind === "basketball" || kind === "football" ? "#b67f59" : "#e4b18b";
  return (
    <svg className={`creature ${className}`} viewBox="0 0 220 250" fill="none" aria-hidden="true">
      <ellipse cx="114" cy="241" rx="74" ry="7" fill="#070916" opacity=".35" />
      <path
        d="m90 169-9 56 21 3 14-42 12 42 22-5-15-54"
        fill="#e3e9ed"
        stroke="#192b30"
        strokeWidth="3"
      />
      <path d="m81 221-12 12q-3 6 5 7h26l2-14m25 1 8 13h24q7-4 0-9l-11-10" fill="#18272b" />
      <path
        d="m79 86-24 30-21-30-12 8 25 45q5 7 13-2l24-23M146 90l20 26 18-27 13 8-20 43q-5 8-13-1l-24-25"
        fill={skin}
        stroke="#273035"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m96 70-21 17-1 78 20 13h43l17-15-8-76-19-16"
        fill={color}
        stroke="#203038"
        strokeWidth="3"
      />
      <path d="m93 74 17 18 20-19" stroke="#f5f2dc" strokeWidth="5" />
      <path d="M81 151h63" stroke="#f2f1e5" strokeWidth="5" />
      <text
        x="113"
        y="133"
        textAnchor="middle"
        fill="#172c30"
        fontSize="35"
        fontWeight="900"
        fontFamily="Arial"
      >
        {number ??
          (kind === "basketball"
            ? "24"
            : kind === "soccer"
              ? "10"
              : kind === "football"
                ? "7"
                : kind === "hockey"
                  ? "99"
                  : "11")}
      </text>
      <path d="M102 64v14q10 12 21 0V62" fill={skin} />
      <path
        d="M88 35q1-25 26-25t26 25v19q-5 26-25 26-21-3-27-26Z"
        fill={skin}
        stroke="#253039"
        strokeWidth="3"
      />
      <path d="M87 40V24q10-24 36-15 23 3 18 35l-12-23-16 10-18-3-1 16Z" fill="#263336" />
      <path d="M102 48h3m19 0h3" stroke="#263238" strokeWidth="4" strokeLinecap="round" />
      <path d="M110 63q7 5 14-2" stroke="#6e4435" strokeWidth="3" strokeLinecap="round" />
      {kind === "basketball" && (
        <>
          <circle cx="26" cy="73" r="26" fill="#e9984d" stroke="#273136" strokeWidth="3" />
          <path
            d="M1 73h50M26 48v50M9 53q30 19 33 39M42 54Q12 74 9 92"
            stroke="#694421"
            strokeWidth="2"
          />
        </>
      )}
      {kind === "soccer" && (
        <>
          <circle cx="180" cy="216" r="24" fill="#f1f1e2" stroke="#273136" strokeWidth="3" />
          <path
            d="m175 204 14 2 4 12-11 8-11-10ZM160 214l9-4m11 17-2 12m15-19 10 3m-23-23-2-7"
            fill="#25373b"
            stroke="#25373b"
            strokeWidth="3"
          />
        </>
      )}
      {kind === "football" && (
        <>
          <path
            d="M86 37Q85 5 114 5t29 32l-7 12h-45Z"
            fill={color}
            stroke="#22323a"
            strokeWidth="3"
          />
          <path d="M87 39h52v16l-12 8H98Z" stroke="#e5e5dc" strokeWidth="4" />
          <path d="M97 44v15m17-15v17m17-17v15" stroke="#e5e5dc" strokeWidth="3" />
          <ellipse
            cx="188"
            cy="80"
            rx="18"
            ry="29"
            transform="rotate(30 188 80)"
            fill="#986444"
            stroke="#293436"
            strokeWidth="3"
          />
          <path d="m187 65-6 23m0-15 9 3m-12 4 9 3" stroke="#f3e7d6" strokeWidth="3" />
        </>
      )}
      {kind === "hockey" && (
        <>
          <path
            d="M88 36Q83 7 113 7t31 30l-8 9-48-2Z"
            fill={color}
            stroke="#22323a"
            strokeWidth="3"
          />
          <path d="M91 38h46v18" stroke="#f0f4f2" strokeWidth="3" />
          <path d="m190 88-28 126 28 9" stroke="#cfb188" strokeWidth="9" strokeLinecap="round" />
          <path d="m82 237 21 2m35 0 20-2" stroke="#c2dce8" strokeWidth="4" />
          <ellipse cx="190" cy="234" rx="15" ry="5" fill="#19262d" />
        </>
      )}
      {kind === "baseball" && (
        <>
          <path d="M86 29q1-25 29-25 26 1 28 24Z" fill={color} stroke="#22323a" strokeWidth="3" />
          <path d="M115 28h38q9 6-1 10h-31" fill={color} stroke="#22323a" strokeWidth="3" />
          <path
            d="m188 99 9-49q2-7 7-5t5 9l-16 48"
            fill="#d4ad76"
            stroke="#283438"
            strokeWidth="3"
          />
          <circle cx="33" cy="85" r="14" fill="#f5eee4" stroke="#283438" strokeWidth="2" />
          <path d="M25 73q15 12 0 22m13-23q-15 12 0 22" stroke="#c4565b" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
export function PackArt({ pack, small = false }: { pack: Pack; small?: boolean }) {
  return (
    <div
      className={`pack-art ${small ? "small" : ""}`}
      style={{ "--pack-color": pack.color, "--pack-dark": pack.dark } as React.CSSProperties}
    >
      <div className="foil-rim" />
      <span className="pack-brand">
        SPORTLET<span>™</span>
      </span>
      <div className="pack-orbit" />
      <Creature kind={pack.kind} color={pack.color} />
      <strong>{pack.name.replace(" Pack", "").toUpperCase()}</strong>
      <span className="pack-sub">1 PLAYER CARD • {pack.names.length} TO DISCOVER</span>
      <div className="foil-rim bottom" />
    </div>
  );
}
