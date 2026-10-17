import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { anything, external, folders, modules } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/effect-form/src");

export default [
	fence("effect-form-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, modules("effect", "@effect/atom-react", "react")))
		.demonstratedBy({
			illegal: ["packages/effect-form/src/form.ts", external("@effect/sql-pg")],
			legal: ["packages/effect-form/src/form.ts", external("effect")],
		}),
];
