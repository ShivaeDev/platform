import type { Element, Root } from "hast";
import { visit as visitElements } from "unist-util-visit";
import { textContent } from "./textContent.ts";

// Longer cells read as prose: they wrap at a readable width, while shorter columns keep each cell on one line.
const PROSE_LENGTH = 24;

function rows(element: Element): Element[] {
	return element.children.flatMap((child) => {
		if (child.type !== "element" || child.tagName === "table") {
			return [];
		}
		return child.tagName === "tr" ? [child] : rows(child);
	});
}

function cells(row: Element) {
	return row.children.filter((child): child is Element => child.type === "element" && (child.tagName === "td" || child.tagName === "th"));
}

export function tableColumns() {
	return (tree: Root) => {
		visitElements(tree, "element", (table) => {
			if (table.tagName !== "table") {
				return;
			}
			const lengths: number[] = [];
			for (const row of rows(table)) {
				cells(row).forEach((cell, column) => {
					lengths[column] = Math.max(lengths[column] ?? 0, textContent(cell).trim().length);
				});
			}
			for (const row of rows(table)) {
				cells(row).forEach((cell, column) => {
					if ((lengths[column] ?? 0) > PROSE_LENGTH) {
						cell.properties.dataColumn = "prose";
					}
				});
			}
		});
	};
}
