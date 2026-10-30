export interface Shown {
	readonly turns: boolean;
}

export interface FlightGroupShown {
	readonly goal: string;
	readonly work: readonly string[];
}

function textOf(node: Element | null | undefined): string {
	return node?.textContent ?? "";
}

function sectionBody(container: Element, title: string): Element {
	const heading = [...container.querySelectorAll("span")].find((node) => node.textContent === title);
	const body = heading?.parentElement?.nextElementSibling;
	if (!body) {
		throw new Error(`The pane has no ${title} section`);
	}
	return body;
}

function flightRows(container: Element): Element[] {
	const body = sectionBody(container, "In flight");
	return [...body.children].flatMap((group) => [...group.children].slice(1));
}

function flightTitle(row: Element): string {
	return textOf(row.firstElementChild?.children[0]);
}

export function inFlightShown(container: Element): string | FlightGroupShown[] {
	const body = sectionBody(container, "In flight");
	if (body.tagName === "SPAN") {
		return textOf(body);
	}
	return [...body.children].map((group) => ({ goal: textOf(group.firstElementChild), work: [...group.children].slice(1).map(flightTitle) }));
}

export function agentsShown(container: Element, title: string, { turns }: Shown): string[] {
	const row = flightRows(container).find((candidate) => flightTitle(candidate) === title);
	if (!row) {
		throw new Error(`In flight shows no ${title}`);
	}
	return [...row.children].slice(1).map((agent) => {
		const [activity = "", turn] = [...agent.children].map(textOf);
		return turns && turn !== undefined ? `${activity} · ${turn}` : activity;
	});
}

function goalsBody(container: Element): Element {
	return sectionBody(container, "Goals");
}

function goalRow(row: Element): string {
	const [title, bar, count] = [...row.children];
	const drawing = bar?.querySelector("[role=img]");
	const progress = drawing ? `drawn ${drawing.getAttribute("aria-label")}` : textOf(bar);
	return `${textOf(title)} · ${progress} · ${textOf(count)}`;
}

export function goalLines(container: Element): string[] {
	return [...goalsBody(container).children].flatMap((child) => {
		if (child.tagName === "SPAN") {
			return [];
		}
		const toggle = child.querySelector(":scope > button");
		return toggle ? [textOf(toggle), ...[...child.children].slice(1).map(goalRow)] : [goalRow(child)];
	});
}

function colorOf(node: Element | null | undefined): string {
	return node instanceof HTMLElement ? node.style.color : "";
}

export function legendShown(container: Element): { readonly color: string; readonly state: string }[] {
	const legend = [...goalsBody(container).children].find((child) => child.tagName === "SPAN");
	if (!legend) {
		throw new Error("The Goals section has no legend");
	}
	return [...legend.children].map((entry) => ({ color: colorOf(entry.firstElementChild), state: textOf(entry).replace("▰", "").trim() }));
}

function barOf(container: Element, title: string): Element {
	const row = [...goalsBody(container).querySelectorAll("div")].find(
		(candidate) => candidate.children.length === 3 && textOf(candidate.firstElementChild) === title,
	);
	const bar = row?.children[1];
	if (!bar) {
		throw new Error(`Goals shows no ${title}`);
	}
	return bar;
}

export function drawingOf(container: Element, title: string): { readonly boundaries: string[]; readonly segments: string[] } {
	const bar = barOf(container, title);
	return {
		boundaries: [...bar.querySelectorAll("svg path")].map((boundary) => boundary.getAttribute("stroke") ?? ""),
		segments: [...bar.querySelectorAll("svg rect")].map((segment) => segment.getAttribute("fill") ?? ""),
	};
}

export function terminalBarOf(container: Element, title: string): { readonly cells: number; readonly color: string }[] {
	return [...barOf(container, title).querySelectorAll("span span")].map((run) => ({ cells: textOf(run).trim().length, color: colorOf(run) }));
}

export function lookOf(container: Element, text: string): string {
	const node = [...container.querySelectorAll("span")].find((candidate) => candidate.textContent === text);
	if (!node) {
		throw new Error(`The pane shows no ${text}`);
	}
	if (node.style.color !== "") {
		return node.style.color;
	}
	return node.style.opacity === "0.7" ? "dimmed" : "plain";
}
