import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";

export const SPACING = 1000;

export function headings() {
	return [...document.querySelectorAll("#doc :is(h1,h2,h3,h4,h5,h6)[id]")];
}

interface Observed {
	readonly callback: IntersectionObserverCallback;
	readonly observer: IntersectionObserver;
	readonly targets: Set<Element>;
}

export class StoryObserver implements IntersectionObserver {
	static readonly observed = new Set<Observed>();
	readonly root = null;
	readonly rootMargin: string;
	readonly scrollMargin = "0px";
	readonly thresholds = [0];
	readonly #observed: Observed;
	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.rootMargin = options?.rootMargin ?? "0px";
		this.#observed = { callback, observer: this, targets: new Set() };
		StoryObserver.observed.add(this.#observed);
	}
	observe(target: Element) {
		this.#observed.targets.add(target);
	}
	unobserve(target: Element) {
		this.#observed.targets.delete(target);
	}
	disconnect() {
		StoryObserver.observed.delete(this.#observed);
	}
	takeRecords() {
		return [];
	}
}

function entry(target: Element): IntersectionObserverEntry {
	const bounds = target.getBoundingClientRect();
	const isIntersecting = bounds.bottom > 0 && bounds.top < window.innerHeight;
	return {
		boundingClientRect: bounds,
		intersectionRatio: isIntersecting ? 1 : 0,
		intersectionRect: isIntersecting ? bounds : new DOMRect(),
		isIntersecting,
		rootBounds: new DOMRect(0, 0, window.innerWidth, window.innerHeight),
		target,
		time: performance.now(),
	};
}

export function outlineActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		scrollToHeading: (id: string) => {
			tell(`the reader scrolls until ${id} sits at the top of the window`);
			const outline = engine.outline;
			if (!outline) {
				throw new Error("The story does not observe the outline");
			}
			outline.offset = Math.max(0, headings().findIndex((heading) => heading.id === id) * SPACING);
			act(() => {
				for (const { callback, observer, targets } of StoryObserver.observed) {
					callback([...targets].map(entry), observer);
				}
			});
		},
	};
}
