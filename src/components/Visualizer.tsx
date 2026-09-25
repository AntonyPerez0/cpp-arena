import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadTrace, type Trace, type TraceStep, type TraceValue, type VisualMeta } from "../content/visuals";
import { highlight } from "./highlight";

// ------------------------------------------------------------------ helpers
/** Every value's display text by path, to spot what changed since the last step. */
function flatten(step: TraceStep): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (v: TraceValue | null, path: string) => {
    if (!v) return;
    out.set(path, `${v.k}:${v.v ?? ""}:${v.to ?? ""}:${v.s ?? ""}`);
    v.items?.forEach((x, i) => walk(x, `${path}[${i}]`));
    v.fields?.forEach((f) => walk(f.v, `${path}.${f.name}`));
  };
  const n = step.frames.length;
  step.frames.forEach((f, i) => f.vars.forEach((x) => walk(x.v, `f${n - 1 - i}:${f.fn}:${x.name}`)));
  step.heap.forEach((h) => walk(h.v, `h:${h.label}`));
  return out;
}

function pointerText(v: TraceValue): string {
  if (v.to) return `points to ${v.tl}`;
  if (v.dangling) return "freed memory (dangling)";
  if (v.v === "NULL" || v.v === "nullptr" || v.v === "0x0") return v.v === "nullptr" ? "nullptr (empty)" : "NULL";
  return v.k === "ref" ? "refers to something not shown" : "somewhere not shown";
}

type Ctx = { prefix: string; changed: Set<string> };

function Value({ v, path, ctx }: { v: TraceValue; path: string; ctx: Ctx }): ReactNode {
  const id = v.id ? `${ctx.prefix}-${v.id}` : undefined;
  const ch = ctx.changed.has(path) ? " changed" : "";
  switch (v.k) {
    case "ptr":
    case "ref": {
      const text = pointerText(v);
      return (
        <span className={"vbox vptr" + (v.dangling ? " dangling" : "") + ch} id={id} data-to={v.to ? `${ctx.prefix}-${v.to}` : undefined} title={v.t}>
          {v.smart && <span className="vsmart">{v.smart}</span>}
          <span className="vptr-text">{text}</span>
          {v.s != null && v.to && <span className="vstr">"{v.s}"</span>}
          {v.uses != null && <span className="vuses">{v.uses} owner{v.uses === 1 ? "" : "s"}</span>}
          <span className={"vdot" + (v.to ? "" : " vdot-null")} aria-hidden="true" />
        </span>
      );
    }
    case "arr":
      return (
        <span className={"varr" + ch} id={id} title={v.t}>
          {v.items?.map((it, i) => (
            <span className="vcell" key={i}>
              <span className="vidx">{i}</span>
              <Value v={it} path={`${path}[${i}]`} ctx={ctx} />
            </span>
          ))}
          {!!v.more && <span className="vmore">+{v.more} more</span>}
        </span>
      );
    case "struct":
      return (
        <span className={"vstruct" + ch} id={id} title={v.t}>
          {v.fields?.length ? (
            v.fields.map((f) => (
              <span className="vfield" key={f.name}>
                <span className="vfname">{f.name}</span>
                <Value v={f.v} path={`${path}.${f.name}`} ctx={ctx} />
              </span>
            ))
          ) : (
            <span className="vfname">(no data members)</span>
          )}
        </span>
      );
    case "text":
      return (
        <span className={"vbox vtext" + ch} id={id} data-to={v.to ? `${ctx.prefix}-${v.to}` : undefined} title={v.t}>
          {v.v}
          {v.to && <span className="vdot" aria-hidden="true" />}
        </span>
      );
    default:
      return (
        <span className={"vbox" + ch} id={id} title={v.t}>
          {v.v}
        </span>
      );
  }
}

/** Draws an arrow from every pointer to what it points at. */
function Arrows({ box, deps }: { box: React.RefObject<HTMLDivElement>; deps: unknown[] }) {
  const [paths, setPaths] = useState<{ d: string; key: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const markerId = useId().replace(/:/g, "");

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const out: { d: string; key: string }[] = [];
    el.querySelectorAll<HTMLElement>("[data-to]").forEach((src, i) => {
      const target = document.getElementById(src.dataset.to!);
      if (!target || !el.contains(target)) return;
      const dot = src.querySelector(".vdot") ?? src;
      const a = dot.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left;
      const y1 = a.top + a.height / 2 - base.top;
      // Aim at the nearest side of the target.
      const tx = b.left - base.left;
      const ty = b.top - base.top;
      let x2: number, y2: number, c1x: number, c1y: number, c2x: number, c2y: number;
      if (tx > x1 + 20) {
        x2 = tx - 2;
        y2 = ty + Math.min(b.height / 2, 14);
        c1x = x1 + Math.max(40, (x2 - x1) / 2);
        c1y = y1;
        c2x = x2 - Math.max(30, (x2 - x1) / 3);
        c2y = y2;
      } else if (ty > y1) {
        x2 = tx + Math.min(b.width / 2, 22);
        y2 = ty - 2;
        c1x = x1 + 50;
        c1y = y1 + 10;
        c2x = x2 + 30;
        c2y = y2 - 40;
      } else {
        x2 = tx + Math.min(b.width / 2, 22);
        y2 = ty + b.height + 2;
        c1x = x1 + 50;
        c1y = y1 - 10;
        c2x = x2 + 30;
        c2y = y2 + 40;
      }
      out.push({ key: `${i}`, d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}` });
    });
    setPaths(out);
    setSize({ w: el.scrollWidth, h: el.scrollHeight });
  }, [box]);

  useLayoutEffect(measure, [measure, ...deps]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [box, measure]);

  return (
    <svg className="varrows" width={size.w} height={size.h} aria-hidden="true">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${markerId})`} />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ main
export default function Visualizer({ meta }: { meta: VisualMeta }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const memRef = useRef<HTMLDivElement>(null);
  const prefix = "vz" + useId().replace(/:/g, "");

  useEffect(() => {
    setTrace(null);
    setI(0);
    setPlaying(false);
    loadTrace(meta.id).then(setTrace, (e) => setError((e as Error).message));
  }, [meta.id]);

  const n = trace?.steps.length ?? 0;
  const step = trace?.steps[i];
  const go = useCallback((k: number) => setI(Math.max(0, Math.min(n - 1, k))), [n]);

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), 900);
    return () => clearTimeout(t);
  }, [playing, i, n]);

  const changed = useMemo(() => {
    if (!trace || i === 0) return new Set<string>();
    const a = flatten(trace.steps[i - 1]);
    const b = flatten(trace.steps[i]);
    const s = new Set<string>();
    b.forEach((val, k) => {
      if (a.get(k) !== val) s.add(k);
    });
    return s;
  }, [trace, i]);

  const lines = meta.code.replace(/\n$/, "").split("\n");
  const callerLines = new Set(step?.frames.slice(1).map((f) => f.line));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(n - 1);
    }
  };

  if (error) return <p className="banner banner-fail">{error}</p>;
  if (!trace || !step) return <p className="muted">Loading the recording…</p>;
  const ctx: Ctx = { prefix, changed };
  const nFrames = step.frames.length;

  return (
    <div className="viz">
      <div className="viz-controls" role="group" aria-label="Step through the program" onKeyDown={onKey}>
        <button className="btn" onClick={() => go(0)} disabled={i === 0} aria-label="First step">
          ⏮
        </button>
        <button className="btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step">
          ◀ Back
        </button>
        <button className="btn btn-primary" onClick={() => (i >= n - 1 ? (setI(0), setPlaying(true)) : setPlaying(!playing))} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button className="btn" onClick={() => go(i + 1)} disabled={i >= n - 1} aria-label="Next step">
          Next ▶
        </button>
        <button className="btn" onClick={() => go(n - 1)} disabled={i >= n - 1} aria-label="Last step">
          ⏭
        </button>
        <input
          className="viz-slider"
          type="range"
          min={0}
          max={n - 1}
          value={i}
          onChange={(e) => {
            setPlaying(false);
            go(Number(e.target.value));
          }}
          aria-label="Step"
          aria-valuetext={`Step ${i + 1} of ${n}, line ${step.line}`}
        />
        <span className="viz-count">
          Step {i + 1} of {n}
        </span>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {playing ? "" : `Step ${i + 1} of ${n}. Line ${step.line}: ${lines[step.line - 1]?.trim() ?? ""}`}
      </p>

      <div className="viz-grid">
        <div className="viz-code-col">
          <div className="lbl">code (the highlighted line runs next)</div>
          <pre className="codeview viz-code" tabIndex={0} aria-label="Program code">
            {lines.map((l, k) => (
              <span key={k} className={"vline" + (k + 1 === step.line ? " vline-cur" : "") + (callerLines.has(k + 1) ? " vline-caller" : "")} aria-current={k + 1 === step.line ? "step" : undefined}>
                <span className="vln" aria-hidden="true">
                  {k + 1}
                </span>
                {highlight(l || " ", `l${k}-`)}
                {"\n"}
              </span>
            ))}
          </pre>
          <div className="lbl">output so far</div>
          <pre className="console viz-out" tabIndex={0}>
            {step.out || " "}
          </pre>
        </div>

        <div className="viz-mem" ref={memRef}>
          <section className="viz-stack" aria-label="Stack: one frame per function call, newest on top">
            <h2 className="viz-h">Stack</h2>
            {step.frames.map((f, fi) => (
              <div key={`${f.fn}-${nFrames - fi}`} className={"vframe" + (fi === 0 ? " vframe-top" : "")}>
                <div className="vframe-head">
                  <b>{f.fn}</b>
                  <span className="muted small">{fi === 0 ? `running line ${f.line}` : `waiting at line ${f.line}`}</span>
                </div>
                {f.vars.length === 0 ? (
                  <div className="muted small">no variables yet</div>
                ) : (
                  <div className="vvars">
                    {f.vars.map((x) => (
                      <Fragment key={x.name}>
                        <span className="vname">
                          {x.name}
                          {x.arg && <span className="visually-hidden"> (parameter)</span>}
                        </span>
                        <Value v={x.v} path={`f${nFrames - 1 - fi}:${f.fn}:${x.name}`} ctx={ctx} />
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
          <section className="viz-heap" aria-label="Heap: memory from malloc and new">
            <h2 className="viz-h">Heap</h2>
            {step.heap.length === 0 ? (
              <div className="muted small">nothing allocated</div>
            ) : (
              step.heap.map((h) => (
                <div key={h.addr + h.label} className="vblock">
                  <div className="vframe-head">
                    <b>{h.label}</b>
                    <span className="muted small">{h.size} bytes</span>
                  </div>
                  {h.note && <div className="muted small">{h.note}</div>}
                  {h.v ? <Value v={h.v} path={`h:${h.label}`} ctx={ctx} /> : <div className="muted small">used inside a library object</div>}
                </div>
              ))
            )}
          </section>
          <Arrows box={memRef} deps={[i, trace]} />
        </div>
      </div>
      <p className="muted small">
        Recorded from a real run compiled with GCC and stepped with gdb. Changed values are outlined. Keyboard: focus the controls and use the arrow keys, Home and End.
      </p>
    </div>
  );
}
