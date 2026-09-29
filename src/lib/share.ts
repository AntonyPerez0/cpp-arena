// Share cards: a 1200x630 image (the size social sites use for previews) drawn
// on a canvas, shared with the phone's share sheet or downloaded.
export type Card = { kicker: string; title: string; lines: string[]; file: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export async function drawCard(card: Card): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext("2d")!;
  const font = '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  await Promise.all([document.fonts.load(`700 40px "Inter Variable"`), document.fonts.load(`800 68px "Inter Variable"`)]).catch(() => {});
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, 1200, 630);
  const glow = ctx.createRadialGradient(1000, 150, 0, 1000, 150, 620);
  glow.addColorStop(0, "rgba(101, 154, 210, 0.22)");
  glow.addColorStop(1, "rgba(101, 154, 210, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);

  // The logo (as in components/Brand.tsx), drawn at twice its 32px size.
  ctx.save();
  ctx.translate(80, 72);
  ctx.scale(2, 2);
  const tile = ctx.createLinearGradient(0, 0, 32, 32);
  tile.addColorStop(0, "#5C6BC0");
  tile.addColorStop(0.55, "#3F75B8");
  tile.addColorStop(1, "#00599C");
  ctx.fillStyle = tile;
  ctx.beginPath();
  ctx.roundRect(0, 0, 32, 32, 8);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineWidth = 3.4;
  ctx.stroke(new Path2D("M17.6 10.1a7.2 7.2 0 1 0 0 11.8"));
  ctx.lineWidth = 3;
  ctx.stroke(new Path2D("M23.4 12.6v6.8M20 16h6.8"));
  ctx.restore();
  ctx.fillStyle = "#f4f4f5";
  ctx.font = `700 40px ${font}`;
  ctx.fillText("C/C++ Arena", 166, 118);

  ctx.fillStyle = "#8AB4E8";
  ctx.font = `700 28px ${font}`;
  ctx.fillText(card.kicker.toUpperCase(), 80, 240);
  ctx.fillStyle = "#fafafa";
  ctx.font = `750 68px ${font}`;
  const titleLines = wrap(ctx, card.title, 1040).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, 80, 320 + i * 78));
  ctx.fillStyle = "#d4d4d8";
  ctx.font = `500 32px ${font}`;
  card.lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 80, 320 + titleLines.length * 78 + 20 + i * 46));
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `600 30px ${font}`;
  ctx.fillText("cpparena.com  ·  learn C and C++ with a real compiler", 80, 580);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}

/** Share the card (phone share sheet) or download it. Returns what happened, for a status message. */
export async function shareCard(card: Card, text: string): Promise<"shared" | "downloaded"> {
  const blob = await drawCard(card);
  const file = new File([blob], card.file, { type: "image/png" });
  const url = location.origin + import.meta.env.BASE_URL;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = card.file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded";
}
