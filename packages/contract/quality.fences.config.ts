import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/contract/src");

export default [
	fence("contract-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(files("packages/changes/src/keys.ts"), browserCode, packages("types"), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/contract/src/contract.ts", external("@effect/sql-pg")],
			legal: ["packages/contract/src/contract.ts", external("effect")],
		}),
];
