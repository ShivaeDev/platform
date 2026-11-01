import type { TestModule } from "vitest/node";

const optionalEngines = /\/node_modules\/(?:happy-dom|react|react-dom|pg|@effect\/(?:atom-react|sql-pg)|@opentelemetry\/[^/]+)(?:\/|$)/u;
const packageBarrels = /\/node_modules\/(?:effect|@effect\/platform-node(?:-shared)?)\/(?:dist|src)\/index\.(?:js|ts)$/u;
const integrationModules =
	/(?:\/(?:packages|node_modules\/@shivaedev)\/test-sql\/|\/server\/internal\/(?:otlp[^/]*|observeBrowser|browserReadObserver)\.(?:ts|js)$|\/node_modules\/effect\/(?:dist|src)\/(?:rpc|socket|sql|reactivity|observability)\/)/u;
const forbidden = [optionalEngines, packageBarrels, integrationModules];

export function importViolations(modules: readonly TestModule[]): string[] {
	return modules.flatMap((module) =>
		Object.keys(module.diagnostic().importDurations)
			.filter((id) => forbidden.some((pattern) => pattern.test(id)))
			.map((id) => `Story-kit collection imported optional module ${id}. Load it when the story uses it.`),
	);
}
