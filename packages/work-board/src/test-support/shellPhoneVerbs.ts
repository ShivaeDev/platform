import type { ScreenEngine } from "./screenEngine.ts";
import { accessibleOf, shellActs, shellElement } from "./shellScreenAct.ts";

const PHONE = 'nav[aria-label="Phone navigation"]';
const MORE = "#phone-more";

function named<E extends HTMLElement>(selector: string, name: string, where: string) {
	const found = [...document.querySelectorAll<E>(selector)].find((candidate) => {
		const accessible = accessibleOf(candidate).name;
		return accessible === name || accessible.startsWith(`${name},`);
	});
	if (!found) {
		throw new Error(`${where} offers no ${name}`);
	}
	return found;
}

function linksOf(selector: string) {
	return [...document.querySelectorAll(selector)].map((link) => ({
		current: link.getAttribute("aria-current") === "page",
		href: link.getAttribute("href"),
		name: accessibleOf(link).name,
	}));
}

export function shellPhoneVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		chooseInMore: (name: string) => acting(`the reader chooses ${name} in More`, () => named(`${MORE} :is(a, button)`, name, "More").click()),
		closeMore: () => acting("the reader closes More", () => named(`${MORE} button`, "Close", "More").click()),
		hostRetries: () => acting("the host retries its page", () => shellElement("[data-retry]", "host Retry button").click()),
		hostShowsUnreadableDocument: () =>
			acting("the host switches to a document that can't be read", () => shellElement("[data-document]", "host Document button").click()),
		liveIndicator: () =>
			reading("the reader reads the live status indicator", () => {
				const live = shellElement("#live", "live status");
				return {
					announced: live.querySelector(".sr-only")?.textContent ?? live.textContent,
					icon: live.querySelector("svg") ? "shown" : "none",
					role: accessibleOf(live).role,
					shown: live.querySelector('span[aria-hidden="true"]')?.textContent ?? "",
					state: live.dataset.state,
				};
			}),
		liveTooltip: () => reading("the reader reads the live status tooltip", () => shellElement("#live", "live status").title),
		moreSheet: () =>
			reading("the reader reads the phone's More sheet", () => {
				if (!document.querySelector(MORE)) {
					return "closed";
				}
				return {
					destinations: linksOf('[aria-label="More destinations"] a').map(({ name }) => name),
					history: [...document.querySelectorAll(`${MORE} button`)].some((button) => button.textContent === "Reading history")
						? "offered"
						: "not offered",
					reading: linksOf(`${MORE} section a`),
				};
			}),
		openMore: () =>
			acting("the reader opens More from the phone navigation", () => {
				const more = shellElement(`${PHONE} button[aria-controls="phone-more"]`, "More button");
				more.focus();
				more.click();
			}),
		openPhoneSearch: () =>
			acting("the reader opens Search from the phone navigation", () => {
				const search = named(`${PHONE} button`, "Search", "The phone navigation");
				search.focus();
				search.click();
			}),
		openPhoneTab: (name: string) =>
			acting(`the reader opens ${name} from the phone navigation`, () => named(`${PHONE} a`, name, "The phone navigation").click()),
		phoneTabs: () => reading("the reader reads the phone navigation's tabs", () => linksOf(`${PHONE} a`)),
	};
}
