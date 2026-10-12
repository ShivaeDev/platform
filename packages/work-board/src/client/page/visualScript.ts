export function visualScript(): string {
	return `
import { inspectImage, inspectDiagram, inspectAttachment } from "/_board/visual-viewport.js";
let revision = 0;
const refresh = () => {
  revision++;
  for (const image of document.querySelectorAll("#doc img[data-local-image]")) {
    image.tabIndex = 0; image.setAttribute("role", "button"); image.setAttribute("aria-label", "Inspect image: " + (image.alt || "Local image"));
    const url = new URL(image.dataset.localImage, location.href); url.searchParams.set("_wb", Date.now() + "-" + revision); image.src = url.href;
    image.onerror = () => {
      if (!image.isConnected || image.nextElementSibling?.hasAttribute("data-image-error")) return;
      const error = document.createElement("span"); error.setAttribute("data-image-error", ""); error.setAttribute("role", "status");
      error.textContent = "Image unavailable. Check the local path, supported type, workspace boundary and 16 MiB limit."; image.after(error);
    };
    image.onload = () => { if (image.nextElementSibling?.hasAttribute("data-image-error")) image.nextElementSibling.remove(); };
  }
};
export const diagramTools = (figure) => {
  let tools = figure.querySelector("[data-visual-tools]");
  if (!tools) {
    tools = document.createElement("span"); tools.setAttribute("data-visual-tools", "");
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Inspect diagram"; button.setAttribute("data-inspect-diagram", "");
    tools.append(button); figure.append(tools);
  }
  tools.querySelector("button").disabled = figure.dataset.state !== "drawn";
};
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const diagram = event.target.closest?.("#doc [data-inspect-diagram]");
  if (diagram && !diagram.disabled) { inspectDiagram(diagram.closest("figure.diagram"), diagram); return; }
  const link = event.target.closest?.('#doc a[href^="/_board/attachment/"]');
  if (link && !link.hasAttribute("download") && (!link.target || link.target === "_self")) { event.preventDefault(); inspectAttachment(link); return; }
  const image = event.target.closest?.("#doc img[data-local-image]"); if (image) { event.preventDefault(); inspectImage(image); }
});
document.addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key) && event.target.matches?.("#doc img[data-local-image]")) { event.preventDefault(); inspectImage(event.target); }
});
document.addEventListener("board-page", refresh);
refresh();
`;
}
