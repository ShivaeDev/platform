import type { Element } from "hast";
import { defineHastPlugin } from "satteri";

const FOOTNOTE_IDS = /^(?:user-content-fn|footnote-label)/;

type Value = Element["properties"][string];

const SCOPED = new Set(["id", "href", "ariaDescribedBy"]);

const scoped = (prefix: string, value: Value): Value => {
	if (typeof value === "string" && FOOTNOTE_IDS.test(value)) {
		return `${prefix}${value}`;
	}
	if (typeof value === "string" && value.startsWith("#") && FOOTNOTE_IDS.test(value.slice(1))) {
		return `#${prefix}${value.slice(1)}`;
	}
	return Array.isArray(value) ? value.map((each) => (typeof each === "string" ? String(scoped(prefix, each)) : each)) : value;
};

export const footnoteIds = (prefix: string) =>
	defineHastPlugin({
		name: "work-board-footnote-ids",
		element: {
			filter: ["a", "h2", "li"],
			visit: (element) => ({
				...element,
				properties: Object.fromEntries(
					Object.entries(element.properties).map(([name, value]) => [name, SCOPED.has(name) ? scoped(prefix, value) : value]),
				),
			}),
		},
	});
