export function visualViewport(): string {
	return `
const dialog = document.getElementById("visual-dialog");
const content = document.getElementById("visual-content");
const viewport = document.getElementById("visual-viewport");
const status = document.getElementById("visual-status");
const download = document.getElementById("visual-download");
let scale = 100;
let baseWidth = 0;
let objectUrl;
let origin;
let images = [];
let selected = -1;
const id = (name) => document.getElementById("visual-" + name);
const release = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = undefined; };
const zoom = (next) => {
  scale = Math.max(25, Math.min(800, next));
  content.style.width = baseWidth ? (baseWidth * scale / 100) + "px" : scale + "%";
  id("actual").setAttribute("aria-pressed", baseWidth ? "true" : "false");
  id("fit").textContent = scale === 100 && !baseWidth ? "Fit" : Math.round(scale) + "% · Fit";
};
const fit = () => { baseWidth = 0; zoom(100); viewport.scrollTop = 0; viewport.scrollLeft = 0; };
const showImage = () => {
  release(); fit(); status.textContent = "";
  const source = images[selected];
  const image = new Image(); image.alt = source.alt;
  image.onerror = () => { if (content.contains(image)) { status.textContent = "Image unavailable. Check the local path, supported type, workspace boundary and 16 MiB limit."; download.removeAttribute("href"); download.setAttribute("aria-disabled", "true"); } };
  image.src = source.src; content.replaceChildren(image);
  id("context").textContent = (source.alt || "Local image") + " · " + (selected + 1) + " of " + images.length + " · " + source.dataset.localImage + " · " + document.getElementById("doc").dataset.file;
  download.href = source.dataset.localImage;
  try { download.download = decodeURIComponent(new URL(download.href).pathname.split("/").at(-1)); } catch { download.download = "work-board-image"; }
  download.setAttribute("aria-disabled", "false");
  id("previous").disabled = selected <= 0; id("next").disabled = selected >= images.length - 1;
};
export const inspectImage = (source) => {
  origin = source; images = [...document.querySelectorAll("#doc img[data-local-image]")]; selected = images.indexOf(source);
  id("previous").hidden = false; id("next").hidden = false; showImage(); dialog.showModal();
};
export const inspectAttachment = (link) => {
  origin = link; const source = { alt: link.textContent, dataset: { localImage: link.getAttribute("href") }, src: link.href };
  images = [source]; selected = 0; id("previous").hidden = false; id("next").hidden = false; showImage(); dialog.showModal();
};
export const inspectDiagram = (figure, trigger) => {
  const drawing = figure.querySelector(".diagram-svg svg");
  if (!drawing) return;
  origin = trigger; selected = -1; images = []; release(); fit(); status.textContent = "";
  const copy = drawing.cloneNode(true); copy.style.maxWidth = "none"; copy.style.width = "100%"; copy.style.height = "auto";
  content.replaceChildren(copy);
  id("context").textContent = "Mermaid diagram · " + document.getElementById("doc").dataset.file + " · Current drawing";
  id("previous").hidden = true; id("next").hidden = true;
  const xml = new XMLSerializer().serializeToString(drawing);
  objectUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  download.href = objectUrl; download.download = "work-board-diagram.svg"; dialog.showModal();
  download.setAttribute("aria-disabled", "false");
};
const move = (offset) => { if (selected < 0) return; selected = Math.max(0, Math.min(images.length - 1, selected + offset)); showImage(); };
id("previous").addEventListener("click", () => move(-1)); id("next").addEventListener("click", () => move(1));
id("in").addEventListener("click", () => zoom(scale * 1.5)); id("out").addEventListener("click", () => zoom(scale / 1.5));
id("fit").addEventListener("click", fit);
id("actual").addEventListener("click", () => {
  const graphic = content.firstElementChild;
  const width = graphic?.naturalWidth || graphic?.viewBox?.baseVal?.width;
  if (!width) { status.textContent = "Original dimensions unavailable; Fit and zoom remain available."; return; }
  baseWidth = width; zoom(100); viewport.scrollTop = 0; viewport.scrollLeft = 0;
});
id("close").addEventListener("click", () => dialog.close());
id("fullscreen").addEventListener("click", async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await id("stage").requestFullscreen(); }
  catch { status.textContent = "Fullscreen is unavailable here; the scrollable viewer remains available."; }
});
dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" && selected >= 0) { event.preventDefault(); move(-1); }
  if (event.key === "ArrowRight" && selected >= 0) { event.preventDefault(); move(1); }
  if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
});
dialog.addEventListener("close", async () => {
  release(); content.replaceChildren();
  if (dialog.contains(document.fullscreenElement)) await document.exitFullscreen().catch(() => {});
  (origin?.isConnected ? origin : document.getElementById("doc")).focus();
});
document.addEventListener("board-page", () => {
  if (dialog.open) { status.textContent = "Source updated. This preview is the drawing/image opened earlier; close and reopen to inspect or save the latest source."; download.removeAttribute("href"); download.setAttribute("aria-disabled", "true"); }
});
window.addEventListener("pagehide", () => { release(); if (dialog.open) dialog.close(); });
`;
}
