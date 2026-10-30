import { Schema } from "effect";

export const PullRequest = Schema.Struct({ number: Schema.Number, title: Schema.String });
export const FIXTURE_TOKEN = "github-fixture-secret";
export const PRIVATE_QUERY = "private-query-secret";

export function pullRequests(...numbers: readonly number[]) {
	return numbers.map((number) => ({ number, title: `Pull request ${number}` }));
}
