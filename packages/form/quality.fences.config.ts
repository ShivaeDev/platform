import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, folders, modules } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/form/src");

export default [
	fence("form-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, modules("effect", "@effect/atom-react", "react")))
		.demonstratedBy({
			illegal: ["packages/form/src/form.ts", external("@effect/sql-pg")],
			legal: ["packages/form/src/form.ts", external("effect")],
		}),
];
