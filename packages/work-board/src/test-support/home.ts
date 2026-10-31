import { projectFiles } from "./boardStory.ts";

export const HOME = "nested/home.md";
export function home(source: string) {
	return projectFiles({ [HOME]: source });
}
