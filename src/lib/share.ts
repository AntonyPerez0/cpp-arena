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
  const g = ctx.createLinearGradient(0, 0, 1200, 630);
  g.addColorStop(0, "#0d0f13");
  g.addColorStop(1, "#1f1316");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = "#ff9f1c";
  ctx.fillRect(0, 0, 1200, 10);

  // Crosshair logo
  ctx.strokeStyle = "#ff9f1c";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(110, 110, 30, 0, Math.PI * 2);
  ctx.moveTo(110, 64);
  ctx.lineTo(110, 86);
  ctx.moveTo(110, 134);
  ctx.lineTo(110, 156);
  ctx.moveTo(64, 110);
  ctx.lineTo(86, 110);
  ctx.moveTo(134, 110);
  ctx.lineTo(156, 110);
  ctx.stroke();
  const font = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = "#e6e9ef";
  ctx.font = `700 40px ${font}`;
  ctx.fillText("C/C++", 170, 124);
  ctx.fillStyle = "#ff9f1c";
  ctx.fillText("Arena", 170 + ctx.measureText("C/C++ ").width, 124);

  ctx.fillStyle = "#ff9f1c";
  ctx.font = `800 30px ${font}`;
  ctx.fillText(card.kicker.toUpperCase(), 80, 240);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 68px ${font}`;
  const titleLines = wrap(ctx, card.title, 1040).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, 80, 320 + i * 78));
  ctx.fillStyle = "#c3c9d4";
  ctx.font = `500 32px ${font}`;
  card.lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 80, 320 + titleLines.length * 78 + 20 + i * 46));
  ctx.fillStyle = "#8b93a3";
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
