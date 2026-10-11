export function sidebarScript(): string {
	return `
export const revealCurrentFile = (expand = false) => {
  const tree = document.getElementById("files");
  const active = tree.querySelector('a[aria-current="page"]');
  if (!active) return;
  let folder = active.closest("details");
  while (folder) {
    if (expand) folder.open = true;
    else if (!folder.open) return;
    folder = folder.parentElement?.closest("details");
  }
  requestAnimationFrame(() => {
    const bounds = tree.getBoundingClientRect();
    const row = active.getBoundingClientRect();
    if (row.top < bounds.top) tree.scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) tree.scrollTop += row.bottom - bounds.bottom;
  });
};

export const setupSidebar = (savedClosed) => {
  const root = document.documentElement;
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");
  const page = document.querySelector(".page");
  const narrow = matchMedia("(max-width: 767px)");
  let desktopClosed = savedClosed;
  let drawerOpen = false;
  const isOpen = () => narrow.matches ? drawerOpen : !desktopClosed;
  const controls = () => [...sidebar.querySelectorAll('a[href], button:not(:disabled), summary')].filter((element) => element.getClientRects().length);
  const render = () => {
    const open = isOpen();
    root.dataset.sidebar = open ? "open" : "closed";
    sidebar.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !narrow.matches || !open;
    page.inert = narrow.matches && open;
    if (narrow.matches && open) {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
    } else {
      sidebar.removeAttribute("role");
      sidebar.removeAttribute("aria-modal");
    }
  };
  const closeDrawer = () => {
    if (!narrow.matches || !drawerOpen) return;
    drawerOpen = false;
    render();
    toggle.focus({ preventScroll: true });
  };
  toggle.addEventListener("click", () => {
    if (narrow.matches) drawerOpen = !drawerOpen;
    else desktopClosed = !desktopClosed;
    render();
    if (narrow.matches && drawerOpen) {
      sidebar.querySelector("a")?.focus({ preventScroll: true });
    }
    if (isOpen()) revealCurrentFile();
    document.dispatchEvent(new Event("board-sidebar"));
  });
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("board-navigate", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (!narrow.matches || !drawerOpen || document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") { event.preventDefault(); closeDrawer(); }
    if (event.key !== "Tab") return;
    const items = controls();
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  narrow.addEventListener("change", () => {
    const focused = sidebar.contains(document.activeElement);
    drawerOpen = false;
    render();
    if (focused && !isOpen()) toggle.focus({ preventScroll: true });
    if (isOpen()) revealCurrentFile();
  });
  render();
  return { closed: () => desktopClosed };
};
`;
}
