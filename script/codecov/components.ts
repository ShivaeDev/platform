import type { WorkspacePackage } from "#lint/workspace.ts";

const HEADING = "component_management:";
const TOP_LEVEL = /^\S/u;

export function components(packages: readonly WorkspacePackage[]): string {
	const entries = packages
		.toSorted((left, right) => left.root.localeCompare(right.root))
		.flatMap(({ name, root }) => [
			`    - component_id: ${root.slice("packages/".length)}`,
			`      name: "${name}"`,
			"      paths:",
			`        - "${root}/src/**"`,
		]);
	return [HEADING, "  individual_components:", ...entries].join("\n");
}

function bounds(codecov: string): { readonly end: number; readonly lines: readonly string[]; readonly start: number } {
	const lines = codecov.split("\n");
	const start = lines.indexOf(HEADING);
	const next = lines.findIndex((line, index) => index > start && TOP_LEVEL.test(line));
	const end = next === -1 ? lines.length : next;
	return { end: start === -1 ? -1 : end, lines, start };
}

export function committedComponents(codecov: string): string | undefined {
	const { end, lines, start } = bounds(codecov);
	return start === -1 ? undefined : lines.slice(start, end).join("\n").trimEnd();
}

export function withComponents(codecov: string, block: string): string {
	const { end, lines, start } = bounds(codecov);
	if (start === -1) {
		return `${codecov.trimEnd()}\n\n${block}\n`;
	}
	const rest = lines.slice(end);
	return [...lines.slice(0, start), block, ...(rest.length > 0 ? ["", ...rest] : [""])].join("\n");
}
