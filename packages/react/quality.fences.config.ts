import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/react/src");

export default [
	fence("react-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(
			anything.except(
				files("packages/changes/src/keys.ts"),
				browserCode,
				packages("access", "contract", "errors", "form", "types"),
				modules("effect", "@effect/atom-react", "@tanstack/react-router", "react"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/react/src/client/resultState.ts", external("vitest")],
			legal: ["packages/react/src/client/resultState.ts", external("effect")],
		}),
];
