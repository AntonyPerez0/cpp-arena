import { useEffect } from "react";

const SITE = "C/C++ Arena";

/** Sets the browser tab title (read first by screen readers on navigation). */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE}: learn C and C++ with a real compiler in your browser`;
  }, [title]);
}
