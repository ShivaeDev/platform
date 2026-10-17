import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { anything, external, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/effect-react/src");

export default [
	fence("effect-react-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(
			anything.except(
				browserCode,
				packages("effect-contract", "effect-form", "types"),
				modules("effect", "@effect/atom-react", "@tanstack/react-router", "react", "react-dom", "vitest"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/effect-react/src/client/resultState.ts", external("@effect/sql-pg")],
			legal: ["packages/effect-react/src/client/resultState.ts", external("effect")],
		}),
];
