import { diagram } from "./diagram.ts";
import { readingPage } from "./readingScreenTraits.tsx";
import { gatedDiagrams } from "./screenDiagrams.ts";
import { screenMedia, screenWorkspace } from "./screenEnvironment.ts";
import { screenTheme } from "./screenWorkspaceTraits.ts";

export function diagramPlan(body: string) {
	return [gatedDiagrams(), readingPage({ "home.md": "# Home", "notes/plan.md": `# Plan${body}` }, "/notes/plan.md")];
}

export function themedDiagramPlan(name: string, theme: "light" | "system" = "light") {
	return [
		screenWorkspace(`diagram-theme-${name}`),
		screenMedia([]),
		screenTheme(theme),
		gatedDiagrams(),
		readingPage({ "home.md": "# Home", "notes/plan.md": `# Plan${diagram(name)}` }, "/notes/plan.md"),
	];
}
