import { defaultExclude, type TestUserConfig } from "vitest/config";
import type { Environment } from "#rules/tests/name.ts";

const EXTENSION = "?(c|m)[jt]s?(x)";

const TYPECHECK_ALONE = `**/typecheck.test.${EXTENSION}`;

function named(environment?: Environment): string {
	return environment === undefined ? `**/*.@(test|spec).${EXTENSION}` : `**/*.${environment}.@(test|spec).${EXTENSION}`;
}

function excluding(exclude: readonly string[], ...patterns: readonly string[]): string[] {
	return [...defaultExclude, named("typecheck"), TYPECHECK_ALONE, ...exclude, ...patterns];
}

export function testProjects({ exclude = [] }: { readonly exclude?: readonly string[] } = {}): TestUserConfig {
	return {
		project: ["unit", "dom"],
		projects: [
			{ extends: true, test: { environment: "node", exclude: excluding(exclude, named("dom"), named("slow")), include: [named()], name: "unit" } },
			{ extends: true, test: { environment: "happy-dom", exclude: excluding(exclude, named("slow")), include: [named("dom")], name: "dom" } },
			{ extends: true, test: { environment: "node", exclude: excluding(exclude), include: [named("slow")], name: "slow" } },
		],
	};
}
