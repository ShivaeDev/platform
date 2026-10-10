let view = "board";
let filter = "all";
let selectedId = "WB–021";
function tagClass(item) {
	if (item.id === "WB–014") {
		return "amber";
	}
	return item.attention ? "green" : "neutral";
}
function card(item) {
	return `<button type="button" class="work-card ${item.id === selectedId ? "selected" : ""}" data-item="${item.id}" aria-pressed="${item.id === selectedId}"><span class="muted">${item.id}</span><strong>${item.title}</strong><p>${item.note}</p><div class="card-bottom"><span>${item.owner}</span><span class="tag ${tagClass(item)}">${item.tag}</span></div></button>`;
}
const destinationLabels = { brief: "Principles and direction", decision: "Scope proposal", evidence: "Supporting evidence" };
function renderDetail() {
	const item = items.find((entry) => entry.id === selectedId);
	document.getElementById("item-detail").innerHTML =
		`<p class="eyebrow">IN CONTEXT / ${item.id}</p><span class="tag ${tagClass(item)}">${item.tag}</span><h2>${item.title}</h2><p>${item.note}</p><dl class="detail-props"><div><dt>State</dt><dd>${item.state}</dd></div><div><dt>Owner</dt><dd>${item.owner}</dd></div><div><dt>Milestone</dt><dd>Wave 1</dd></div></dl><div class="detail-section"><h3>The next step</h3><p>${item.next}</p></div><div class="detail-section"><h3>Connected context</h3><a href="#brief">→ The project brief</a><a href="#${item.destination}">→ ${destinationLabels[item.destination]}</a></div><div class="detail-section"><p>Source: work/${item.id.toLowerCase().replace("–", "-")}.md</p><p class="small-note">Illustrative source path</p></div>`;
}
function renderWork() {
	const visible = items.filter((item) => filter === "all" || (filter === "attention" ? item.attention : item.owner === "Atlas"));
	if (!visible.some((item) => item.id === selectedId)) {
		selectedId = visible[0].id;
	}
	const content = document.getElementById("work-content");
	if (view === "board") {
		content.innerHTML = `<div class="kanban">${["Up next", "In progress", "In review"]
			.map((state) => {
				const group = visible.filter((item) => item.state === state);
				return `<section class="lane" aria-label="${state}"><div class="lane-heading">${state}<span>${group.length}</span></div>${group.map(card).join("") || '<p class="empty-filter">No matching work.</p>'}</section>`;
			})
			.join("")}</div>`;
	} else {
		content.innerHTML = `<table class="work-table"><thead><tr><th>WORK ITEM</th><th>STATE</th><th>OWNER</th></tr></thead><tbody>${visible.map((item) => `<tr><td><button type="button" data-item="${item.id}" aria-pressed="${item.id === selectedId}"><span class="muted">${item.id}</span><br>${item.title}</button></td><td><span class="tag ${tagClass(item)}">${item.state}</span></td><td>${item.owner}</td></tr>`).join("")}</tbody></table>`;
	}
	renderDetail();
}
function updateChoice(kind, value) {
	for (const button of document.querySelectorAll(`[data-${kind}]`)) {
		const selected = button.dataset[kind] === value;
		button.classList.toggle("selected", selected);
		button.setAttribute("aria-pressed", String(selected));
	}
}
document.querySelector(".work-toolbar").addEventListener("click", (event) => {
	const button = event.target.closest("button");
	if (!button) {
		return;
	}
	if (button.dataset.view) {
		view = button.dataset.view;
		updateChoice("view", view);
	}
	if (button.dataset.filter) {
		filter = button.dataset.filter;
		updateChoice("filter", filter);
	}
	renderWork();
});
document.getElementById("work-content").addEventListener("click", (event) => {
	const button = event.target.closest("[data-item]");
	if (!button) {
		return;
	}
	selectedId = button.dataset.item;
	renderWork();
	document.querySelector(`[data-item="${selectedId}"]`).focus({ preventScroll: true });
});
