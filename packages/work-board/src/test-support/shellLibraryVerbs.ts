import type { ScreenEngine } from "./screenEngine.ts";
import { setNativeValue } from "./setNativeValue.ts";
import { accessibleOf, shellActs, shellElement } from "./shellScreenAct.ts";

const FILTERS = "#library-filters";

function libraryLinks() {
	return [...document.querySelectorAll<HTMLAnchorElement>("#library-results li a")];
}

function libraryLink(title: string) {
	const link = libraryLinks().find((candidate) => candidate.textContent === title);
	if (!link) {
		throw new Error(`The Library lists no ${title}`);
	}
	return link;
}

function buttonNamed(name: string, within = "#doc") {
	const button = [...document.querySelectorAll<HTMLElement>(`${within} button`)].find((candidate) => candidate.textContent === name);
	if (!button) {
		throw new Error(`The page has no ${name} button`);
	}
	return button;
}

export function shellLibraryVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		filterLibrary: (filter: "Kind" | "Status", option: string) =>
			acting(`the reader chooses ${option} in the Library's ${filter} filter`, async () => {
				shellElement(filter === "Kind" ? "#library-kind" : "#library-status", `${filter} filter`).click();
				await Promise.resolve();
				const choice = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) => accessibleOf(candidate).name === option);
				if (!choice) {
					throw new Error(`The ${filter} filter offers no ${option}`);
				}
				choice.click();
			}),
		findInLibrary: (text: string) =>
			acting(`the reader finds ${JSON.stringify(text)} in the Library and applies it`, () => {
				const field = shellElement<HTMLInputElement>("#library-query", "Find documents field");
				setNativeValue(field, text);
				field.dispatchEvent(new Event("input", { bubbles: true }));
				buttonNamed("Apply", FILTERS).click();
			}),
		fleetFilesToggle: () =>
			reading("the reader reads the Library's Fleet files toggle", () => {
				const toggle = shellElement(`${FILTERS} [role="checkbox"]`, "Fleet files toggle");
				return { checked: toggle.getAttribute("aria-checked") === "true", name: accessibleOf(toggle).name };
			}),
		includeFleetFilesInLibrary: () =>
			acting("the reader toggles the Library's Include files Fleet writes", () =>
				shellElement(`${FILTERS} [role="checkbox"]`, "Fleet files toggle").click(),
			),
		libraryAddress: () =>
			reading("the reader reads the Library's address", () => {
				const route = new URL(document.querySelector<HTMLElement>("#doc")?.dataset.route ?? "", "http://board");
				return route.pathname === "/_board/library" ? Object.fromEntries(route.searchParams) : `left the Library for ${route.pathname}`;
			}),
		libraryFilters: () =>
			reading("the reader reads the Library's filter controls", () => ({
				fleet: document.querySelector(`${FILTERS} [role="checkbox"]`)?.getAttribute("aria-checked") === "true",
				kind: document.querySelector('#library-kind [data-slot="select-value"]')?.textContent,
				query: document.querySelector<HTMLInputElement>("#library-query")?.value,
				reset: document.querySelector(`${FILTERS} a`)?.textContent === "Reset" ? "offered" : "not offered",
				status: document.querySelector('#library-status [data-slot="select-value"]')?.textContent,
				view: document.querySelector(`${FILTERS} [role="group"] [aria-pressed="true"]`)?.textContent,
			})),
		libraryFolders: () =>
			reading("the reader reads the Library's folders", () =>
				[...document.querySelectorAll("#library-results summary")].map((summary) => summary.textContent),
			),
		libraryRow: (title: string) =>
			reading(`the reader reads the Library row for ${title}`, () => {
				const row = libraryLink(title).closest("li");
				return {
					details: row?.querySelector("p")?.textContent,
					tabStops: [...(row?.querySelectorAll<HTMLElement>("*") ?? [])]
						.filter((candidate) => candidate.tabIndex >= 0 && !candidate.matches(":disabled"))
						.map((candidate) => candidate.textContent),
					updated: row?.querySelector("[data-updated]")?.textContent,
				};
			}),
		libraryStatus: () => reading("the reader reads the Library's count", () => document.querySelector('#doc [role="status"]')?.textContent),
		libraryTitles: () => reading("the reader reads the titles the Library lists", () => libraryLinks().map((link) => link.textContent)),
		openLibraryDocument: (title: string) => acting(`the reader opens ${title} from the Library`, () => libraryLink(title).click()),
		openLibraryFolder: (name: string) =>
			acting(`the reader opens the Library folder ${name}`, () => {
				const folder = [...document.querySelectorAll<HTMLDetailsElement>("#library-results details")].find((candidate) =>
					candidate.querySelector("summary")?.textContent?.startsWith(`${name} (`),
				);
				if (!folder) {
					throw new Error(`The Library has no folder ${name}`);
				}
				folder.open = true;
				folder.dispatchEvent(new Event("toggle"));
			}),
		resetLibraryFilters: () =>
			acting("the reader resets the Library's filters", () => {
				const reset = [...document.querySelectorAll<HTMLElement>(`${FILTERS} a`)].find((link) => link.textContent === "Reset");
				if (!reset) {
					throw new Error("The Library offers no Reset");
				}
				reset.click();
			}),
		showLibraryView: (view: string) => acting(`the reader shows the Library ${view}`, () => buttonNamed(view, `${FILTERS} [role="group"]`).click()),
		showMoreDocuments: () => acting("the reader clicks Show more", () => buttonNamed("Show more").click()),
		showMoreOffered: () =>
			reading("the reader looks for Show more", () =>
				[...document.querySelectorAll("#doc button")].some((button) => button.textContent === "Show more") ? "offered" : "not offered",
			),
	};
}
