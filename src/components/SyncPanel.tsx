import { useEffect, useState, useSyncExternalStore } from "react";
import { importProgress, mergeStates, getState, update, type State } from "../state/store";
import { forgetGist, gistConfig, loadFromGist, makeTransferLink, qrSvg, readTransfer, saveToGist, setGistAuto, setGistToken, syncStatus } from "../lib/sync";

const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=C%2FC%2B%2B%20Arena%20sync";

function summary(s: State) {
  const steps = Object.values(s.steps).filter((x) => x.done).length;
  return `${steps} lesson step${steps === 1 ? "" : "s"}, ${s.dm.kills} Deathmatch kills, best streak ${s.dm.best.deathmatch}`;
}

/** Shown when the page was opened from a transfer link. */
export function IncomingTransfer() {
  const [incoming, setIncoming] = useState<State | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const m = location.hash.match(/^#transfer=([\w-]+)$/);
    if (!m) return;
    readTransfer(m[1])
      .then(setIncoming)
      .catch(() => setMsg("That transfer link is damaged or incomplete. Make a new one on your other device."));
  }, []);
  const clear = () => history.replaceState(null, "", location.pathname);
  if (!incoming && !msg) return null;
  return (
    <section className="card card-callout" aria-labelledby="incoming-h">
      <h2 className="h3" id="incoming-h">
        Progress from another device
      </h2>
      {incoming ? (
        <>
          <p>
            This link holds: <b>{summary(incoming)}</b>. Merging keeps everything from both devices; nothing here is lost.
          </p>
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                update((s) => mergeStates(s, incoming));
                setIncoming(null);
                setMsg("Merged. This device now has the progress from both.");
                clear();
              }}
            >
              Merge into this device
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setIncoming(null);
                setMsg("");
                clear();
              }}
            >
              Ignore
            </button>
          </div>
        </>
      ) : (
        <p role="status">{msg}</p>
      )}
    </section>
  );
}

export default function SyncPanel({ onFile, onMessage }: { onFile: () => void; onMessage: (m: string) => void }) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [cfg, setCfg] = useState(gistConfig());
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const status = useSyncExternalStore(syncStatus.subscribe, syncStatus.get);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const makeLink = async () => {
    const l = await makeTransferLink();
    setLink(l);
    setQr(await qrSvg(l));
  };

  const gist = async (what: "save" | "load") => {
    setBusy(true);
    try {
      if (what === "save") {
        await saveToGist();
        onMessage("Saved to your private gist.");
      } else {
        const found = await loadFromGist();
        onMessage(found ? "Loaded from your gist and merged: " + summary(getState()) + "." : "No saved progress in your gists yet. Press Save to create it.");
      }
      setCfg(gistConfig());
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="sync-h">
      <h2 className="h3" id="sync-h">
        Sync and backup
      </h2>
      <p className="muted small">Progress is saved in this browser. Use one of these to move it to another phone or computer, or to keep a backup.</p>

      <h3 className="sub-h">1. Transfer link (quickest)</h3>
      <p className="small">Opens this page on the other device and merges your progress there. Saved code stays behind; finished steps, drills and ranks move.</p>
      <div className="actions">
        <button className="btn" onClick={makeLink}>
          Make a transfer link
        </button>
        {link && (
          <>
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                onMessage("Link copied. Open it on your other device.");
              }}
            >
              Copy link
            </button>
            {canShare && (
              <button className="btn" onClick={() => navigator.share({ title: "My C/C++ Arena progress", url: link }).catch(() => {})}>
                Share
              </button>
            )}
          </>
        )}
      </div>
      {link && (
        <div className="transfer">
          {qr ? (
            <div className="qr" role="img" aria-label="QR code of the transfer link. Scan it with the other device's camera." dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <p className="small muted">You have too much progress to fit in a QR code. Copy or share the link instead (for example, message it to yourself).</p>
          )}
          <input className="answer-input small" readOnly value={link} aria-label="Transfer link" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <h3 className="sub-h">2. Private GitHub Gist (automatic)</h3>
      {cfg ? (
        <>
          <p className="small">
            Connected. Progress is stored in a secret gist in your GitHub account, including your saved code.
            {cfg.last ? ` Last synced ${new Date(cfg.last).toLocaleString()}.` : ""}
          </p>
          <div className="actions">
            <button className="btn" onClick={() => gist("save")} disabled={busy}>
              Save now
            </button>
            <button className="btn" onClick={() => gist("load")} disabled={busy}>
              Load and merge
            </button>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={cfg.auto}
                onChange={(e) => {
                  setGistAuto(e.target.checked);
                  setCfg(gistConfig());
                }}
              />{" "}
              Sync automatically
            </label>
            <button
              className="btn btn-ghost"
              onClick={() => {
                forgetGist();
                setCfg(null);
                onMessage("Token removed from this browser. Your gist is still on GitHub.");
              }}
            >
              Disconnect
            </button>
          </div>
          {status.state !== "idle" && (
            <p className={"small " + (status.state === "error" ? "bad" : "muted")} role="status">
              {status.message}
            </p>
          )}
        </>
      ) : (
        <>
          <ol className="small steps-ol">
            <li>
              <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">
                Create a GitHub token<span className="visually-hidden"> (opens in a new tab)</span>
              </a>{" "}
              with only the <b>gist</b> box ticked. Pick an expiry you're happy with.
            </li>
            <li>Paste it below and connect. Do the same on your other devices with the same token.</li>
          </ol>
          <form
            className="actions"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token.trim()) return;
              setGistToken(token, true);
              setCfg(gistConfig());
              setToken("");
              await gist("load");
              await gist("save");
            }}
          >
            <input className="answer-input" type="password" autoComplete="off" placeholder="ghp_..." aria-label="GitHub token with the gist permission" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn btn-primary" disabled={!token.trim() || busy}>
              Connect
            </button>
          </form>
          <p className="muted small">The token stays in this browser and is only sent to GitHub. It is never included in exports or transfer links.</p>
        </>
      )}

      <h3 className="sub-h">3. File</h3>
      <div className="actions">
        <button className="btn" onClick={onFile}>
          Export progress file
        </button>
        <label className="btn">
          Import progress file
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importProgress(await f.text());
                onMessage("Progress imported and merged.");
              } catch (err) {
                onMessage("Import failed: " + (err as Error).message);
              }
            }}
          />
        </label>
      </div>
    </section>
  );
}
