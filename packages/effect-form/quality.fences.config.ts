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
	fence("effect-form-never-imports-server")
		.because("Browser packages ship to browsers and never import a server package.")
		.from(folders("packages/effect-form/src"))
		.mayNotImport(packages(...SERVER))
		.demonstratedBy({
			illegal: ["packages/effect-form/src/form.ts", "packages/effect-sql/src/repository.ts"],
			legal: ["packages/effect-form/src/form.ts", external("effect")],
		}),
];
