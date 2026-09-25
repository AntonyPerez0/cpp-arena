import { reportUrl, type ReportInfo } from "../lib/site";

/** "Report a problem" link that opens a pre-filled GitHub issue in a new tab. */
export default function ReportLink({ info, className = "report-link" }: { info: () => ReportInfo; className?: string }) {
  return (
    <a
      className={className}
      href="https://github.com"
      target="_blank"
      rel="noopener noreferrer"
      // Build the link when it's used, so it includes the latest code.
      onClick={(e) => (e.currentTarget.href = reportUrl(info()))}
      onAuxClick={(e) => (e.currentTarget.href = reportUrl(info()))}
      onFocus={(e) => (e.currentTarget.href = reportUrl(info()))}
      onMouseEnter={(e) => (e.currentTarget.href = reportUrl(info()))}
    >
      <span aria-hidden="true">⚑</span> Report a problem<span className="visually-hidden"> (opens GitHub in a new tab)</span>
    </a>
  );
}
