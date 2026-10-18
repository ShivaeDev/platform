import { relative } from "node:path";
import { JUnitReporter, type Vitest } from "vitest/node";

export function junitClassname(file: string, project: string): string {
	return project === "" ? file : `|${project}| ${file}`;
}

export class RerunJunitReporter extends JUnitReporter {
	readonly #root: { path: string };

	constructor(outputFile: string) {
		const root = { path: "" };
		super({
			addFileAttribute: true,
			classnameTemplate: ({ displayName, filepath }) => junitClassname(relative(root.path, filepath), displayName),
			outputFile,
		});
		this.#root = root;
	}

	override onInit(vitest: Vitest) {
		this.#root.path = vitest.config.root;
		return super.onInit(vitest);
	}
}
