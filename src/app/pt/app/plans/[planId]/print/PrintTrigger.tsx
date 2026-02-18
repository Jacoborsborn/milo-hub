"use client";

import { useEffect, useRef } from "react";

/**
 * Opens the print dialog once when the content is ready.
 * Call with ready={true} after plan data has been loaded and rendered.
 */
export default function PrintTrigger({ ready }: { ready: boolean }) {
  const printed = useRef(false);

  useEffect(() => {
    if (ready && !printed.current) {
      printed.current = true;
      window.print();
    }
  }, [ready]);

  return null;
}
