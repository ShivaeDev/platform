export function searchResultsScript(): string {
	return `
const results = document.getElementById("search-results");
const input = document.getElementById("search-query");
let selected = -1;
const commands = [
 { kind: "command", title: "Open workspace", href: "/" },
 { kind: "command", title: "Show or hide files", command: "sidebar-toggle" },
 { kind: "command", title: "Toggle compact density", command: "density" },
 { kind: "command", title: "Toggle light or dark theme", command: "theme" },
];
export const matchingCommands = (query) => commands.filter(item => item.title.toLowerCase().includes(query.trim().toLowerCase()));
export const choose = (index) => {
 const options = [...results.querySelectorAll("a")];
 selected = options.length ? (index + options.length) % options.length : -1;
 options.forEach((option, at) => option.setAttribute("aria-selected", String(at === selected)));
 if (selected >= 0) {
  input.setAttribute("aria-activedescendant", options[selected].id);
  options[selected].scrollIntoView({ block: "nearest" });
 } else input.removeAttribute("aria-activedescendant");
};
export const move = (delta) => choose(selected + delta);
export const activate = () => results.querySelector('a[aria-selected="true"]')?.click();
export const showResults = (items) => {
 results.replaceChildren();
 items.forEach((item, index) => {
  const li = document.createElement("li");
  li.setAttribute("role", "presentation");
  const link = document.createElement("a");
  link.id = "search-result-" + index;
  link.href = item.href ?? "#";
  link.setAttribute("role", "option");
  if (item.command) link.dataset.command = item.command;
  const title = document.createElement("strong");
  title.textContent = item.title;
  const source = document.createElement("small");
  source.textContent = item.kind + (item.file ? " · " + item.file + (item.line ? ":" + item.line : "") : "");
  link.append(title, source);
  if (item.snippet) {
   const snippet = document.createElement("p");
   snippet.textContent = item.snippet;
   link.append(snippet);
  }
  li.append(link); results.append(li);
 });
 choose(0);
};
results.addEventListener("click", (event) => {
 const link = event.target.closest("a");
 if (!link) return;
 const control = document.getElementById(link.dataset.command);
 if (control) {
  event.preventDefault();
  if (control.id === "sidebar-toggle") control.click();
  else {
   control.value = control.id === "density" ? (control.value === "compact" ? "comfortable" : "compact") : (control.value === "dark" ? "light" : "dark");
   control.dispatchEvent(new Event("change"));
  }
 }
 document.getElementById("search-dialog").close(!control && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey ? "navigate" : "");
});
`;
}
