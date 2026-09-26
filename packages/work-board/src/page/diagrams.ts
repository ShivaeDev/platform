export const diagrams = `
const rendered = new Map();
const dark = matchMedia("(prefers-color-scheme: dark)");
let mermaid;
let counter = 0;

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const load = async () => {
  mermaid ??= (await import("/_board/mermaid/mermaid.esm.min.mjs")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      darkMode: dark.matches,
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

const schemeNow = () => (dark.matches ? "dark" : "light");

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
    figure.insertAdjacentHTML("afterbegin", '<div class="diagram-svg">' + svg + "</div>");
    figure.dataset.state = "drawn";
  } catch (error) {
    rendered.delete(key);
    if (scheme !== schemeNow()) return;
    figure.querySelector(".diagram-svg")?.remove();
    figure.dataset.state = "failed";
    figure.dataset.error = String(error?.message ?? error);
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

dark.addEventListener("change", () => {
  mermaid = undefined;
  renderDiagrams(document, "figure.diagram");
});
`;
