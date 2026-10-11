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
	fence("effect-contract-never-imports-server")
		.because("Browser packages ship to browsers and never import a server package.")
		.from(folders("packages/effect-contract/src"))
		.mayNotImport(packages(...SERVER))
		.demonstratedBy({
			illegal: ["packages/effect-contract/src/contract.ts", "packages/effect-sql/src/repository.ts"],
			legal: ["packages/effect-contract/src/contract.ts", external("effect")],
		}),
];
