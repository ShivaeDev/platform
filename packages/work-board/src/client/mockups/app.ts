import { element } from "./element.ts";
import { names, searchEntries } from "./sampleData.ts";
import { renderWork, selectWork } from "./work.ts";

let toastTimer: ReturnType<typeof setTimeout> | undefined;
const searchDialog = element("#search-dialog", HTMLDialogElement);
const searchInput = element("#search-input", HTMLInputElement);

function navigate() {
	const requested = location.hash.slice(1);
	const screen = Object.hasOwn(names, requested) ? requested : "overview";
	for (const section of document.querySelectorAll<HTMLElement>(".screen")) {
		section.hidden = section.id !== screen;
	}
	for (const link of document.querySelectorAll<HTMLAnchorElement>("nav a")) {
		const active = link.dataset.screen === screen;
		link.classList.toggle("active", active);
		if (active) {
			link.setAttribute("aria-current", "page");
		} else {
			link.removeAttribute("aria-current");
		}
	}
	element("#breadcrumb", HTMLElement).textContent = names[screen] ?? "Overview";
	document.title = `${names[screen]} — Work Board vision`;
	window.scrollTo(0, 0);
}
function notify(message: string) {
	const toast = element("#toast", HTMLElement);
	clearTimeout(toastTimer);
	toast.textContent = message;
	toast.hidden = false;
	toastTimer = setTimeout(() => {
		toast.hidden = true;
	}, 5000);
}
function renderSearch() {
	const query = searchInput.value.trim().toLowerCase();
	const matches = searchEntries.filter((entry) => `${entry.title} ${entry.detail}`.toLowerCase().includes(query));
	element("#search-results", HTMLElement).innerHTML =
		matches
			.map(
				(entry) =>
					`<a href="#${entry.screen}" ${entry.item ? `data-search-item="${entry.item}"` : ""}>${entry.title}<small>${entry.detail}</small></a>`,
			)
			.join("") || '<p class="small-note">No matches. Try “decision”, “navigation”, or “Atlas”.</p>';
}
function openSearch() {
	renderSearch();
	searchDialog.showModal();
	searchInput.focus();
}
function respond(revisionRequested: boolean) {
	const text = element("#direction", HTMLTextAreaElement).value.trim();
	if (!text) {
		element("#direction", HTMLTextAreaElement).focus();
		notify("Add some direction before continuing.");
		return;
	}
	const status = element("#decision-status", HTMLElement);
	status.textContent = revisionRequested ? "Revision requested · demo" : "Option A selected · demo";
	status.className = "tag green";
	const result = element("#decision-result", HTMLElement);
	result.textContent = revisionRequested
		? "Demo: your feedback would return to Atlas with proposal revision 3 attached."
		: "Demo: this direction would be recorded against proposal revision 3 and included in Atlas’s next handoff.";
	result.hidden = false;
	notify("Preview updated. No source files changed and no agent was contacted.");
}
window.addEventListener("hashchange", navigate);
element("#search-launch", HTMLElement).addEventListener("click", openSearch);
element("#close-search", HTMLElement).addEventListener("click", () => searchDialog.close());
searchInput.addEventListener("input", renderSearch);
document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		if (!searchDialog.open) {
			openSearch();
		}
	}
});
element("#search-results", HTMLElement).addEventListener("click", (event) => {
	const link = event.target instanceof Element ? event.target.closest("a") : null;
	if (!link) {
		return;
	}
	if (link.dataset.searchItem) {
		selectWork(link.dataset.searchItem);
	}
	searchDialog.close();
});
for (const button of document.querySelectorAll<HTMLElement>("[data-artifact]")) {
	button.addEventListener("click", () => {
		for (const tab of document.querySelectorAll<HTMLElement>("[data-artifact]")) {
			const active = tab === button;
			tab.classList.toggle("selected", active);
			tab.setAttribute("aria-selected", String(active));
			element(`#artifact-${tab.dataset.artifact}`, HTMLElement).hidden = !active;
		}
	});
}
element("#approve", HTMLElement).addEventListener("click", () => respond(false));
element("#revise", HTMLElement).addEventListener("click", () => respond(true));
element("#send-feedback", HTMLElement).addEventListener("click", () => {
	const input = element("#review-note", HTMLTextAreaElement);
	if (!input.value.trim()) {
		input.focus();
		notify("Add feedback so the next pass has clear direction.");
		return;
	}
	notify("Demo revision request prepared for Juniper. Nothing was sent or saved.");
});
renderWork();
navigate();
