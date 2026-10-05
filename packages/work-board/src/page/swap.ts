export const swap = `
const containers = new Set(["DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "NAV", "FORM", "SELECT", "LABEL", "ASIDE"]);

const structural = (element) => [...element.childNodes].every((node) => node.nodeType === 1 || node.textContent.trim() === "");

const pristine = new WeakMap();

export const remember = (element) => {
  pristine.set(element, element.outerHTML);
  if (containers.has(element.tagName)) for (const child of element.children) remember(child);
};

const normalized = (element) => {
  const copy = element.cloneNode(true);
  for (const node of [copy, ...copy.querySelectorAll("*")]) {
    if (node.tagName === "DETAILS") node.removeAttribute("open");
    if (node.matches("figure.diagram")) {
      node.querySelector(".diagram-svg")?.remove();
      node.dataset.state = "pending";
      delete node.dataset.error;
    }
    if (node.matches("[data-modified]")) node.textContent = "";
  }
  return copy.outerHTML;
};

const signature = (element) => {
  if (!pristine.has(element)) pristine.set(element, normalized(element));
  return pristine.get(element);
};

const sameShell = (old, next) =>
  old.tagName === next.tagName && containers.has(old.tagName) && old.cloneNode(false).outerHTML === next.cloneNode(false).outerHTML;

const matches = (a, b) => {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let tail = 0;
  while (tail < a.length - start && tail < b.length - start && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const n = a.length - start - tail;
  const m = b.length - start - tail;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[start + i] === b[start + j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = Array.from({ length: start }, (_, index) => [index, index]);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[start + i] === b[start + j]) pairs.push([start + i++, start + j++]);
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  for (let index = tail; index > 0; index--) pairs.push([a.length - index, b.length - index]);
  return [...pairs, [a.length, b.length]];
};

const patch = (current, incoming) => {
  const selected = current.tagName === "SELECT" ? current.value : null;
  const fallback = incoming.tagName === "SELECT" ? incoming.value : null;
  if (!structural(current) || !structural(incoming)) {
    current.replaceChildren(...incoming.childNodes);
    for (const child of current.children) remember(child);
    return;
  }
  const olds = [...current.children];
  const news = [...incoming.children];
  const signatures = news.map((next) => next.outerHTML);
  const arrive = (index) => {
    remember(news[index]);
    return news[index];
  };
  let i = 0;
  let j = 0;
  for (const [kept, arrived] of matches(olds.map(signature), signatures)) {
    const anchor = olds[kept] ?? null;
    for (; i < kept && j < arrived; i++, j++) {
      if (sameShell(olds[i], news[j])) {
        patch(olds[i], news[j]);
        pristine.set(olds[i], signatures[j]);
      } else olds[i].replaceWith(arrive(j));
    }
    for (; i < kept; i++) olds[i].remove();
    for (; j < arrived; j++) current.insertBefore(arrive(j), anchor);
    i++;
    j++;
  }
  if (selected !== null) current.value = [...current.options].some((option) => option.value === selected) ? selected : fallback;
};

const keysOf = (root) => {
  const seen = new Map();
  return [...root.querySelectorAll("details")].map((details) => {
    const base =
      details.dataset.key ??
      (details.closest(".item")?.querySelector("h3")?.textContent ?? "") + "|" + (details.querySelector("summary")?.textContent ?? "");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return [base + "#" + count, details];
  });
};

const carryDrawings = (drawings, figures) => {
  if (drawings.length !== figures.length) return;
  figures.forEach((figure, index) => {
    const drawing = drawings[index];
    if (figure.dataset.state !== "pending" || drawing === null || drawing.isConnected) return;
    figure.prepend(drawing);
    figure.dataset.state = "redrawing";
  });
};

export const swap = (current, incoming) => {
  const before = keysOf(current);
  const open = new Map(before.map(([key, details]) => [key, details.open]));
  const existing = new Set(before.map(([, details]) => details));
  const drawings = [...current.querySelectorAll("figure.diagram")].map((figure) => figure.querySelector(".diagram-svg"));
  patch(current, incoming);
  carryDrawings(drawings, [...current.querySelectorAll("figure.diagram")]);
  for (const [key, details] of keysOf(current)) {
    const was = open.get(key);
    if (was !== undefined && !existing.has(details)) details.open = was;
  }
};
`;
