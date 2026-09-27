import { useState } from "react";
import { Share2 } from "lucide-react";
import { shareCard, type Card } from "../lib/share";

/** Makes a share image for an achievement and opens the share sheet (or downloads it). */
export default function ShareButton({ card, text, label = "Share" }: { card: Card; text: string; label?: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        className="btn"
        onClick={async () => {
          try {
            const how = await shareCard(card, text);
            setMsg(how === "downloaded" ? "Image saved. Post it anywhere." : "");
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}
      >
        <Share2 className="icon" aria-hidden="true" /> {label}
      </button>
      <span className="visually-hidden" role="status">
        {msg}
      </span>
      {msg && <span className="small muted">{msg}</span>}
    </>
  );
}
