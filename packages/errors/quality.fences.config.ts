import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, folders, modules } from "@shivaedev/quality/imports/fences/selectors.ts";

const errors = folders("packages/errors/src");

export default [
	fence("errors-stay-browser-safe")
		.because("Browsers decode the same failures servers raise, so every shipped module reaches only effect.")
		.from(errors)
		.mayNotReach(anything.except(errors, modules("effect")))
		.demonstratedBy({
			illegal: ["packages/errors/src/taxonomy.ts", external("node:fs")],
			legal: ["packages/errors/src/taxonomy.ts", external("effect")],
		}),
];
