import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

export function screenHeaderLayout(expanded: number, compact: number) {
	return screenStory.trait("workspace", `the browser lays out page headers ${expanded} pixels tall, or ${compact} pixels when compact`, (engine) => {
		const measure = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")?.get;
		const footprints: number[] = [];
		engine.headerFootprints = footprints;
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
			if (!this.hasAttribute("data-page-header")) {
				return measure?.call(this) ?? 0;
			}
			const height = this.hasAttribute("data-compact") ? compact : expanded;
			// happy-dom has no grid layout. Observe the row when a read would force browser layout, including reads during React effects.
			const row = [...(this.parentElement?.children ?? [])].filter(
				(child): child is HTMLElement => child instanceof HTMLElement && child !== this && child.classList.contains("row-start-1"),
			);
			footprints.push(
				Math.max(height + (Number.parseFloat(this.style.marginBottom) || 0), ...row.map((child) => Number.parseFloat(child.style.height) || 0)),
			);
			return height;
		});
	});
}
