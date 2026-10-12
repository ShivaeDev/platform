export function reactNavigationScript(): string {
	return `
const navigateReact = async (route, mine, id, entry, cached, target, status) => {
      await new Promise((resolve, reject) => {
        const signal = controller.signal;
        const check = () => { if (document.getElementById("doc")?.dataset.route === route) { cleanup(); resolve(); } };
        const cancel = () => { cleanup(); reject(new Error("Navigation cancelled")); };
        const cleanup = () => { document.removeEventListener("board-page", check); signal.removeEventListener("abort", cancel); };
        document.addEventListener("board-page", check);
        signal.addEventListener("abort", cancel, { once: true });
        check();
      });
      if (mine !== version) return;
      if (cached && document.querySelector("[data-legacy-main]") && document.getElementById("doc")?.dataset.view === "changes") applyPage(cached.page);
      const doc = document.getElementById("doc");
      displayedId = id;
      displayedRoute = route;
      const code = Number(doc.dataset.status ?? 200);
      status.textContent = code < 400 ? "" : code === 404 ? "This document is missing or was renamed." : "Could not open this document. Retry the link or reload the page.";
      if (code < 400) reportMissingPassage();
      revealCurrentFile(true);
      refreshLibrary(true);
      doc.focus({ preventScroll: true });
      const reading = savedReading[id] ?? entry?.reading ?? cached?.reading;
      if (reading) restoreReading(reading);
      else scrollToPassage(target.hash);
      return;
};
`;
}
