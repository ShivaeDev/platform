export function pageStateScript(): string {
	return `
import { remember, swap } from "/_board/swap.js";
import { renderDiagrams } from "/_board/diagrams.js";
import { captureReading, reportMissingPassage, restoreReading } from "/_board/reading-state.js";
import { refreshLibrary } from "/_board/library.js";

export const syncInbox = () => {
  const count = document.getElementById("inbox-count");
  const topbarCount = document.getElementById("inbox-topbar-count");
  if (count && topbarCount) {
    topbarCount.textContent = count.textContent;
    topbarCount.setAttribute("aria-label", count.getAttribute("aria-label"));
  }
  for (const id of ["inbox-open", "inbox-topbar"]) document.getElementById(id)?.setAttribute("aria-current", document.getElementById("doc").dataset.view === "inbox" ? "page" : "false");
};

export const capturePage = () => {
  const page = document.implementation.createHTMLDocument(document.title);
  for (const id of ["files", "doc", "breadcrumbs", "inbox-topbar"]) page.body.append(document.getElementById(id).cloneNode(true));
  return { page, reading: captureReading() };
};

export const applyPage = (page, preserve = false) => {
  const incoming = page.getElementById("doc");
  const current = document.getElementById("doc");
  if (!incoming || !page.getElementById("files")) return false;
  const reading = preserve ? captureReading() : null;
  const cachedScheme = incoming.dataset.scheme;
  if (preserve && (current.dataset.file === incoming.dataset.file || (current.dataset.identity && current.dataset.identity === incoming.dataset.identity))) {
    if (current.dataset.view === "changes" && incoming.dataset.view === "changes") {
      for (const selector of ["#changes-content", ".history-controls"]) {
        const content = current.querySelector(selector);
        if (content) incoming.querySelector(selector)?.replaceWith(content.cloneNode(true));
      }
    }
    swap(current, incoming, true);
  } else {
    current.replaceWith(document.importNode(incoming, true));
    remember(document.getElementById("doc"));
  }
  const doc = document.getElementById("doc");
  doc.className = incoming.className;
  doc.dataset.file = incoming.dataset.file;
  if (incoming.dataset.identity) doc.dataset.identity = incoming.dataset.identity; else delete doc.dataset.identity;
  doc.dataset.url = incoming.dataset.url;
  if (incoming.dataset.view) doc.dataset.view = incoming.dataset.view; else delete doc.dataset.view;
  document.getElementById("work-open")?.setAttribute("aria-current", doc.dataset.view === "work" ? "page" : "false");
  document.getElementById("overview-open")?.setAttribute("aria-current", doc.dataset.view === "overview" ? "page" : "false");
  document.getElementById("changes-open")?.setAttribute("aria-current", doc.dataset.view === "changes" ? "page" : "false");
  doc.dataset.scheme = document.documentElement.dataset.scheme;
  swap(document.getElementById("files"), page.getElementById("files"));
  const inbox = page.getElementById("inbox-topbar");
  if (inbox) document.getElementById("inbox-topbar").replaceWith(document.importNode(inbox, true));
  syncInbox();
  const crumbs = page.getElementById("breadcrumbs");
  if (crumbs) document.getElementById("breadcrumbs").replaceChildren(...document.importNode(crumbs, true).childNodes);
  if (!preserve) {
    let folder = document.querySelector('#files a[aria-current="page"]')?.closest("details");
    while (folder) {
      folder.open = true;
      folder = folder.parentElement?.closest("details");
    }
  }
  refreshLibrary(!preserve);
  if (reading) restoreReading({ ...reading, selection: null }, false);
  renderDiagrams(document, cachedScheme && cachedScheme !== doc.dataset.scheme ? "figure.diagram" : undefined);
  reportMissingPassage();
  document.dispatchEvent(new Event("board-page"));
  return true;
};
`;
}
