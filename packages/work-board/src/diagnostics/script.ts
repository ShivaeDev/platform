import { resetLabel } from "./resetLabel.ts";

export function diagnosticsScript(): string {
	return `
import { session } from "/_board/native.js";
const resetLabel = ${resetLabel.toString()};
const localizeResets = () => {
  for (const time of document.querySelectorAll("time[data-reset]")) {
    time.textContent = resetLabel(Date.parse(time.dateTime), Date.now());
  }
};
localizeResets();
document.addEventListener("board-page", localizeResets);
const refresh = () => {
  if (location.pathname !== "/_board/diagnostics" || document.visibilityState === "hidden") return;
  const native = session(window);
  const page = native.api.page.query({ url: location.pathname + location.search });
  if (!native.registry.get(native.updates.paused) && !native.registry.get(page).waiting) native.registry.refresh(page);
};
let timer = setInterval(refresh, 15000);
document.addEventListener("visibilitychange", refresh);
document.addEventListener("board-updates-resumed", refresh);
window.addEventListener("pagehide", () => clearInterval(timer));
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  clearInterval(timer);
  timer = setInterval(refresh, 15000);
});
`;
}
