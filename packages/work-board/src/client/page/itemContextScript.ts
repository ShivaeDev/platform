export function itemContextScript(): string {
	return `
const contextIsWide = () => matchMedia("(min-width: 1100px)").matches;
let contextWide = contextIsWide();
let contextFile;
const syncContexts = (reset = false) => {
  const file = document.getElementById("doc").dataset.file;
  for (const context of document.querySelectorAll(".item-context")) {
    if (reset || file !== contextFile) context.open = contextWide;
  }
  contextFile = file;
};
syncContexts();
window.addEventListener("resize", () => {
  const wide = contextIsWide();
  if (wide !== contextWide) { contextWide = wide; syncContexts(true); }
});
document.addEventListener("board-page", () => syncContexts());
`;
}
