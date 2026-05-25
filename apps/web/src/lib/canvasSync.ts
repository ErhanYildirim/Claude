// Canvas-platform senkronizasyon yardımcıları

export function dispatchResourceUpdate(
  sourceType: "installation" | "cbamFacility" | "cbamProduct",
  sourceId: string,
  changes: Record<string, unknown>,
) {
  window.dispatchEvent(
    new CustomEvent("voltfox:resource-updated", {
      detail: { sourceType, sourceId, changes },
    }),
  );
}

export function dispatchResourceDeleted(
  sourceType: "installation" | "cbamFacility" | "cbamProduct",
  sourceId: string,
) {
  dispatchResourceUpdate(sourceType, sourceId, { deleted: true });
}
