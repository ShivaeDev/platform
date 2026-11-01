import { rerunStory } from "./kit.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

export function declaresRetry(kind: "test" | "suite" | "object" | "skipped test" | "rerun") {
	return rerunStory.trait("tests", `retry.spec.ts declares a retry on a ${kind}`, (suite) => {
		const option = kind === "object" ? "{ count: 1 }" : "1";
		const retry = kind === "rerun" ? "attempt > 1 ? 1 : 0" : option;
		const body =
			kind === "test"
				? `() => {
	if (!failed) {
		failed = true;
		throw new Error('Recovers inside the worker');
	}
}`
				: `() => {
	if (attempt === 1 && ${JSON.stringify(kind)} === 'rerun') {
		throw new Error('The first attempt fails');
	}
}`;
		writeFile(
			suite,
			"retry.spec.ts",
			perAttempt(
				kind === "suite"
					? `describe('checkout', { retry: ${retry} }, () => {
	it('charges once', ${body});
	it('sends receipt', ${body});
});`
					: `let failed = false;
describe('checkout', () => {
	${kind === "skipped test" ? "it.skip" : "it"}('charges once', { retry: ${retry} }, ${body});
});`,
			),
		);
	});
}
