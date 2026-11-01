import { perAttempt } from "./specFiles.ts";

export type IdentityChange = "test name" | "suite name" | "task kind";

const recovers = `() => {
	if (attempt === 1) {
		throw new Error('The first attempt fails');
	}
}`;

export function changingIdentity(change: IdentityChange): string {
	if (change === "task kind") {
		return perAttempt(`
(attempt === 1 ? describe.skip : it.skip)('pending checkout', () => {});
it('recovers', ${recovers});
`);
	}
	const suite = change === "suite name" ? "attempt === 1 ? 'checkout' : 'renamed checkout'" : "'checkout'";
	const test = change === "test name" ? "attempt === 1 ? 'recovers' : 'renamed recovery'" : "'recovers'";
	return perAttempt(`
describe(${suite}, () => {
	it(${test}, ${recovers});
});
`);
}
