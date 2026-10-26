import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/contract/src");

export default [
	fence("effect-contract-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, packages("types"), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/contract/src/contract.ts", external("@effect/sql-pg")],
			legal: ["packages/contract/src/contract.ts", external("effect")],
		}),
];
