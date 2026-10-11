import { remember } from "#browser/reconcile/signature.ts";
import { swap } from "#browser/reconcile/swap.ts";
import { captureFocus, restoreFocus } from "./formFocus.ts";
export interface MainLocation {
	readonly file: string;
	readonly view: string;
}
export function legacyPage(html: string): Document {
	const page = new DOMParser().parseFromString(/<body[^>]*>(?<body>[\s\S]*)<\/body>/iu.exec(html)?.groups?.body ?? html, "text/html");
	const template = page.querySelector<HTMLTemplateElement>("#board-legacy-page");
	if (template) {
		page.body.replaceChildren(template.content.cloneNode(true));
	}
	return page;
}
export function commitMain(host: HTMLElement, page: Document): MainLocation | undefined {
	const incoming = page.getElementById("doc");
	if (!incoming) {
		return;
	}
	const current = host.querySelector<HTMLElement>("#doc");
	const preserve = samePage(current, incoming);
	const selection = preserve ? captureFocus(host) : undefined;
	if (preserve) {
		retainHistory(current, incoming);
		swap(current, incoming, true);
		for (const attribute of [...current.attributes]) {
			current.removeAttribute(attribute.name);
		}
		for (const attribute of incoming.attributes) {
			current.setAttribute(attribute.name, attribute.value);
		}
	} else {
		host.replaceChildren(document.importNode(incoming, true));
		const main = host.querySelector("#doc");
		if (main) {
			remember(main);
		}
	}
	const main = host.querySelector<HTMLElement>("#doc");
	if (!main) {
		return;
	}
	main.dataset.scheme = document.documentElement.dataset.scheme ?? "";
	document.dispatchEvent(new Event("board-page"));
	restoreFocus(main, selection);
	return { file: main.dataset.file ?? "", view: main.dataset.view ?? "" };
}

function retainHistory(current: HTMLElement, incoming: HTMLElement) {
	if (current.dataset.view !== "changes" || incoming.dataset.view !== "changes") {
		return;
	}
	for (const selector of ["#changes-content", ".history-controls"]) {
		const content = current.querySelector(selector);
		if (content) {
			incoming.querySelector(selector)?.replaceWith(content.cloneNode(true));
		}
	}
}

function samePage(current: HTMLElement | null, incoming: HTMLElement): current is HTMLElement {
	if (!current) {
		return false;
	}
	return (
		current.dataset.file === incoming.dataset.file || Boolean(current.dataset.identity && current.dataset.identity === incoming.dataset.identity)
	);
}
