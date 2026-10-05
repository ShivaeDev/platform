import { posix } from "node:path";

export const ENVIRONMENTS = ["dom", "slow", "typecheck"] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export interface TestName {
	readonly extension: string;
	readonly folder: string;
	readonly kind: "spec" | "test";
	readonly modifiers: readonly string[];
	readonly stem: string;
}

const TEST_FILE = /^(?<base>.+)\.(?<kind>test|spec)(?<extension>\.[cm]?[jt]sx?)$/u;

export function testName(path: string): TestName | undefined {
	const groups = TEST_FILE.exec(posix.basename(path))?.groups;
	const kind = groups?.kind;
	if (groups?.base === undefined || groups.extension === undefined || (kind !== "test" && kind !== "spec")) {
		return undefined;
	}
	const [stem = "", ...modifiers] = groups.base.split(".");
	return { extension: groups.extension, folder: posix.dirname(path), kind, modifiers, stem };
}

const TEST_SUPPORT = "test-support";

export function isTestSupport(path: string): boolean {
	return posix.dirname(path).split("/").includes(TEST_SUPPORT);
}

export function isTestCode(path: string): boolean {
	return testName(path) !== undefined || isTestSupport(path);
}
