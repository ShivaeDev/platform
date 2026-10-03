import { defaultExclude, type TestUserConfig } from "vitest/config";

const TEST = "**/*.test.?(c|m)[jt]s?(x)";
const DOM = "**/*.dom.test.?(c|m)[jt]s?(x)";
const SLOW = "**/*.slow.test.?(c|m)[jt]s?(x)";
const TYPECHECK = "**/*.typecheck.test.?(c|m)[jt]s?(x)";
const TYPECHECK_ALONE = "**/typecheck.test.?(c|m)[jt]s?(x)";

function excluding(...patterns: readonly string[]): string[] {
	return [...defaultExclude, TYPECHECK, TYPECHECK_ALONE, ...patterns];
}

export function testProjects(): TestUserConfig {
	return {
		project: ["unit", "dom"],
		projects: [
			{ extends: true, test: { environment: "node", exclude: excluding(DOM, SLOW), include: [TEST], name: "unit" } },
			{ extends: true, test: { environment: "happy-dom", exclude: excluding(SLOW), include: [DOM], name: "dom" } },
			{ extends: true, test: { environment: "node", exclude: excluding(), include: [SLOW], name: "slow" } },
		],
	};
}
