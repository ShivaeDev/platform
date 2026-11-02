import { relative } from "node:path";
import { JUnitReporter, type Vitest } from "vitest/node";
import { junitClassname } from "#internal/junitClassname.ts";

export class RerunJunitReporter extends JUnitReporter {
	unhandledErrors: NonNullable<Parameters<JUnitReporter["onTestRunEnd"]>[1]> = [];
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

	override onTestRunEnd(...args: Parameters<JUnitReporter["onTestRunEnd"]>) {
		this.unhandledErrors = args[1] ?? [];
		return super.onTestRunEnd(...args);
	}

	override onInit(vitest: Vitest) {
		this.#root.path = vitest.config.root;
		return super.onInit(vitest);
	}
}
