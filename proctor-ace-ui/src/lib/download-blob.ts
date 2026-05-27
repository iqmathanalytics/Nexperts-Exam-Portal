/** Trigger a file save in the browser (works after async fetch if revoke is delayed). */
export function downloadBlob(blob: Blob, filename: string) {
  if (blob.size === 0) {
    throw new Error("Empty file");
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Revoking immediately can cancel the download before it starts.
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    a.remove();
  }, 60_000);
}
