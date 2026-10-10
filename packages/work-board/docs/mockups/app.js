let toastTimer;
const searchDialog = document.getElementById("search-dialog");
const searchInput = document.getElementById("search-input");

function navigate() {
	const requested = location.hash.slice(1);
	const screen = Object.hasOwn(names, requested) ? requested : "overview";
	for (const element of document.querySelectorAll(".screen")) {
		element.hidden = element.id !== screen;
	}
	for (const link of document.querySelectorAll("nav a")) {
		const active = link.dataset.screen === screen;
		link.classList.toggle("active", active);
		if (active) {
			link.setAttribute("aria-current", "page");
		} else {
			link.removeAttribute("aria-current");
		}
	}
	document.getElementById("breadcrumb").textContent = names[screen];
	document.title = `${names[screen]} — Work Board vision`;
	window.scrollTo(0, 0);
}
function notify(message) {
	const toast = document.getElementById("toast");
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
	document.getElementById("search-results").innerHTML =
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
function respond(revisionRequested) {
	const text = document.getElementById("direction").value.trim();
	if (!text) {
		document.getElementById("direction").focus();
		notify("Add some direction before continuing.");
		return;
	}
	const status = document.getElementById("decision-status");
	status.textContent = revisionRequested ? "Revision requested · demo" : "Option A selected · demo";
	status.className = "tag green";
	const result = document.getElementById("decision-result");
	result.textContent = revisionRequested
		? "Demo: your feedback would return to Atlas with proposal revision 3 attached."
		: "Demo: this direction would be recorded against proposal revision 3 and included in Atlas’s next handoff.";
	result.hidden = false;
	notify("Preview updated. No source files changed and no agent was contacted.");
}
window.addEventListener("hashchange", navigate);
document.getElementById("search-launch").addEventListener("click", openSearch);
document.getElementById("close-search").addEventListener("click", () => searchDialog.close());
searchInput.addEventListener("input", renderSearch);
document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		if (!searchDialog.open) {
			openSearch();
		}
	}
});
document.getElementById("search-results").addEventListener("click", (event) => {
	const link = event.target.closest("a");
	if (!link) {
		return;
	}
	if (link.dataset.searchItem) {
		selectedId = link.dataset.searchItem;
		filter = "all";
		updateChoice("filter", filter);
		renderWork();
	}
	searchDialog.close();
});
for (const button of document.querySelectorAll("[data-artifact]")) {
	button.addEventListener("click", () => {
		for (const tab of document.querySelectorAll("[data-artifact]")) {
			const active = tab === button;
			tab.classList.toggle("selected", active);
			tab.setAttribute("aria-selected", String(active));
			document.getElementById(`artifact-${tab.dataset.artifact}`).hidden = !active;
		}
	});
}
document.getElementById("approve").addEventListener("click", () => respond(false));
document.getElementById("revise").addEventListener("click", () => respond(true));
document.getElementById("send-feedback").addEventListener("click", () => {
	const input = document.getElementById("review-note");
	if (!input.value.trim()) {
		input.focus();
		notify("Add feedback so the next pass has clear direction.");
		return;
	}
	notify("Demo revision request prepared for Juniper. Nothing was sent or saved.");
});
renderWork();
navigate();
