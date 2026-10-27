import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/react/src");

export default [
	fence("react-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(
			anything.except(
				browserCode,
				files("packages/test/src/eventually.ts", "packages/test/src/withLive.ts"),
				packages("access", "contract", "errors", "form", "types"),
				modules("effect", "@effect/atom-react", "@tanstack/react-router", "react", "react-dom", "vitest"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/react/src/client/resultState.ts", external("@effect/sql-pg")],
			legal: ["packages/react/src/client/resultState.ts", external("effect")],
		}),
];
