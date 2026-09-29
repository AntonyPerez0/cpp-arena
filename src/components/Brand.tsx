import { useId } from "react";

/**
 * The C/C++ Arena mark: a tile blending the C logo's indigo into the C++ logo's blue, holding
 * a white "C" and a plus, for C and C++.
 * The same drawing is in public/favicon.svg and scripts/make-icons.mjs.
 */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C6BC0" />
          <stop offset="0.55" stopColor="#3F75B8" />
          <stop offset="1" stopColor="#00599C" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity="0.25" />
      <path d="M17.6 10.1a7.2 7.2 0 1 0 0 11.8" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M23.4 12.6v6.8M20 16h6.8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BrandWordmark() {
  return (
    <>
      <BrandMark />
      <span className="brand-name">
        C/C++ <b>Arena</b>
      </span>
    </>
  );
}
