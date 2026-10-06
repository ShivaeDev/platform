export const diagrams = `
import { diagramTools } from "/_board/visuals.js";
const rendered = new Map();
const dark = matchMedia("(prefers-color-scheme: dark)");
let mermaid;
let counter = 0;

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const load = async () => {
  mermaid ??= (await import("/_board/mermaid/mermaid.esm.min.mjs")).default;
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      darkMode: schemeNow() === "dark",
      background: token("--bg"),
      primaryColor: token("--surface"),
      primaryTextColor: token("--text"),
      primaryBorderColor: token("--border"),
      lineColor: token("--muted"),
      textColor: token("--text"),
      fontFamily: token("--sans"),
    },
  });
  return mermaid;
};

const schemeNow = () => document.documentElement.dataset.scheme ?? (dark.matches ? "dark" : "light");
let lastScheme = schemeNow();

const draw = async (figure) => {
  const source = figure.querySelector(".diagram-source").textContent;
  const scheme = schemeNow();
  const key = scheme + ":" + source;
  if (!rendered.has(key)) {
    rendered.set(key, load().then((engine) => engine.render("diagram-" + ++counter, source)).then((result) => result.svg));
  }
  try {
    const svg = await rendered.get(key);
    if (scheme !== schemeNow()) {
      rendered.delete(key);
      return;
    }
    figure.querySelector(".diagram-svg")?.remove();
    figure.querySelector("[data-diagram-error]")?.remove();
    figure.insertAdjacentHTML("afterbegin", '<div class="diagram-svg">' + svg + "</div>");
    figure.dataset.state = "drawn";
    diagramTools(figure);
  } catch (error) {
    rendered.delete(key);
    if (scheme !== schemeNow()) return;
    figure.querySelector(".diagram-svg")?.remove();
    figure.dataset.state = "failed";
    figure.dataset.error = String(error?.message ?? error);
    figure.querySelector("[data-diagram-error]")?.remove();
    const message = document.createElement("p"); message.setAttribute("data-diagram-error", ""); message.setAttribute("role", "status");
    message.textContent = "Diagram could not be drawn: " + figure.dataset.error; figure.append(message);
    diagramTools(figure);
  }
};

const forget = (root) => {
  const shown = new Set([...root.querySelectorAll("figure.diagram .diagram-source")].map((source) => source.textContent));
  for (const key of rendered.keys()) {
    if (!shown.has(key.slice(key.indexOf(":") + 1))) rendered.delete(key);
  }
};

export const renderDiagrams = (root, selector = "figure.diagram:not([data-state=drawn])") => {
  forget(root);
  return Promise.all([...root.querySelectorAll(selector)].map(draw));
};

const themeChanged = () => {
  const scheme = schemeNow();
  if (lastScheme === scheme) return;
  lastScheme = scheme;
  const doc = document.getElementById("doc");
  if (doc) doc.dataset.scheme = scheme;
  mermaid = undefined;
  renderDiagrams(document, "figure.diagram");
};
document.addEventListener("board-theme", themeChanged);
dark.addEventListener("change", themeChanged);
`;
