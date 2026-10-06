import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defaultExclude, type TestProjectConfiguration, type TestTagDefinition, type TestUserConfig } from "vitest/config";
import type { Environment } from "#naming/testName.ts";

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

type ConfigFunction = (env: { readonly command: "serve"; readonly mode: "test" }) => unknown;

function isConfigFunction(value: unknown): value is ConfigFunction {
	return typeof value === "function";
}

function tagsOf(config: unknown): readonly TestTagDefinition[] {
	const test = typeof config === "object" && config !== null && "test" in config ? config.test : undefined;
	const tags = typeof test === "object" && test !== null && "tags" in test ? test.tags : undefined;
	return Array.isArray(tags)
		? tags.filter((tag): tag is TestTagDefinition => typeof tag === "object" && tag !== null && typeof tag.name === "string")
		: [];
}

async function declaredTags(configFile: string): Promise<readonly TestTagDefinition[]> {
	const loaded: { readonly default?: unknown } = await import(pathToFileURL(configFile).href);
	return tagsOf(isConfigFunction(loaded.default) ? await loaded.default({ command: "serve", mode: "test" }) : await loaded.default);
}

// Vitest reads an inline project's tags only from the project itself, never from the config file it extends.
export function inheritTags(projects: readonly TestProjectConfiguration[], root: string): Promise<TestProjectConfiguration[]> {
	return Promise.all(
		projects.map(async (project) => {
			if (typeof project !== "object" || !("extends" in project) || typeof project.extends !== "string") {
				return project;
			}
			const own = project.test?.tags ?? [];
			const inherited = (await declaredTags(resolve(root, project.extends))).filter((tag) => !own.some((mine) => mine.name === tag.name));
			return { ...project, test: { ...project.test, tags: [...own, ...inherited] } };
		}),
	);
}
