import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { external, folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const SERVER = [
	"effect-changes-prisma",
	"effect-pg-boss",
	"effect-prisma",
	"effect-sql",
	"effect-test-sql",
	"effect-trpc",
	"local-postgres",
	"pr-watch",
	"platform",
	"work-board",
	"work-fleet",
];

export default [
	fence("effect-react-never-imports-server")
		.because("Browser packages ship to browsers and never import a server package.")
		.from(folders("packages/effect-react/src"))
		.mayNotImport(packages(...SERVER))
		.demonstratedBy({
			illegal: ["packages/effect-react/src/client/resultState.ts", "packages/effect-sql/src/repository.ts"],
			legal: ["packages/effect-react/src/client/resultState.ts", external("effect")],
		}),
];
