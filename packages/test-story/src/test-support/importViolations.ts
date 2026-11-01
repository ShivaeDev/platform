import type { TestModule } from "vitest/node";

const optional =
	/(?:\/node_modules\/(?:happy-dom|react|react-dom|pg|@effect\/(?:atom-react|sql-pg)|@opentelemetry\/[^/]+)(?:\/|$)|\/(?:packages|node_modules\/@shivaedev)\/test-sql\/|\/server\/internal\/(?:otlp[^/]*|observeBrowser|browserReadObserver)\.(?:ts|js)$|\/node_modules\/effect\/(?:dist|src)\/(?:index\.(?:js|ts)$|(?:rpc|socket|sql|reactivity|observability)\/))/u;

export function importViolations(modules: readonly TestModule[]): string[] {
	return modules.flatMap((module) =>
		Object.keys(module.diagnostic().importDurations)
			.filter((id) => optional.test(id))
			.map((id) => `Story-kit collection imported optional module ${id}. Load it when the story uses it.`),
	);
}
