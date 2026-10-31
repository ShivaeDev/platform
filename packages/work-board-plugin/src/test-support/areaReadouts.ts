import { Effect } from "effect";

export function areaReadouts(container: Element, tell: (text: string) => void) {
	return {
		areaDetails: () =>
			Effect.sync(() => {
				tell("read the open area's holder and ordered queue");
				const heading = [...container.querySelectorAll("span")].find((span) => span.textContent === "Areas");
				const details = heading?.parentElement?.children[2];
				return details === undefined
					? []
					: [...details.children].map((line) => [...line.children].map((part) => part.textContent).join(" ") || line.textContent);
			}),
		areaState: (name: string) =>
			Effect.sync(() => {
				tell(`read ${name}'s area chip`);
				const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === name);
				const state = button?.nextElementSibling;
				if (!(state instanceof HTMLElement)) {
					throw new Error(`No area chip for ${name}`);
				}
				return { color: state.style.color, state: state.textContent };
			}),
	};
}
