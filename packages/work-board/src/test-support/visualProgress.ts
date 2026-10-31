import { projectFiles } from "./boardStory.ts";

export const VISUAL_HOME = "nested/home.md";

export function visualProgress(attributes: string) {
	return `:::progress${attributes}\nBrowser checks recorded\n\nSource: [Reading checks](../checks.md)\n:::\n`;
}

export function visualHome(source: string) {
	return projectFiles({ [VISUAL_HOME]: source });
}
