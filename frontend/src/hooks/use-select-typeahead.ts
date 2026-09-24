import React from "react";

import {
  appendTypeaheadChar,
  findTypeaheadMatch,
  isTypeaheadChar,
  resetTypeaheadBuffer,
  type SelectTypeaheadBuffer,
  type SelectTypeaheadOption,
} from "@/lib/select-typeahead";

export function useSelectTypeahead() {
  const bufferRef = React.useRef<SelectTypeaheadBuffer>({ text: "", timer: null });

  React.useEffect(() => {
    return () => resetTypeaheadBuffer(bufferRef.current);
  }, []);

  function handleTypeaheadKeyDown(
    event: React.KeyboardEvent<HTMLSelectElement>,
    options: SelectTypeaheadOption[],
    currentValue: string,
    onMatch: (value: string) => void,
  ): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (!isTypeaheadChar(event.key)) {
      return;
    }

    event.preventDefault();
    const needle = appendTypeaheadChar(bufferRef.current, event.key);
    const match = findTypeaheadMatch(options, needle, currentValue);
    if (match) {
      onMatch(match.value);
    }
  }

  function clearTypeahead(): void {
    resetTypeaheadBuffer(bufferRef.current);
  }

  return { handleTypeaheadKeyDown, clearTypeahead };
}
