import { Effect, Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Api, migrations } from "./feature.ts";
import { openHost } from "./openHost.ts";
import { openViewer } from "./openViewer.ts";

const database = environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL");
const postgres = makePostgresTestLayer({ migrations, url: Redacted.make(database ?? "postgresql://disabled") });
export const liveCost = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		yield* PostgresTestDatabase;
		const host = yield* openHost;
		const initial: string[][] = [];
		const audience: Effect.Success<ReturnType<typeof openViewer>>[] = [];
		return { baseline: { ...host.cost }, host, initial, viewers: audience };
	},
	layer: postgres,
	name: "shared bucket live cost",
	runIf: database !== undefined,
	stages: ["viewers"],
	verbs: (state) => ({
		cost: () => ({
			checks: state.host.cost.checks - state.baseline.checks,
			lookups: state.host.cost.lookups - state.baseline.lookups,
			reruns: state.host.cost.reruns - state.baseline.reruns,
		}),
		edit: (text: string) =>
			Effect.gen(function* () {
				const rpc = yield* RpcClient.make(Api, { flatten: true }).pipe(
					Effect.provide(
						RpcClient.layerProtocolHttp({ url: state.host.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
					),
				);
				yield* rpc("costWrites.edit", { text });
			}),
		initialResults: () => state.initial,
		recordBaseline: () =>
			Effect.sync(() => {
				state.baseline = { ...state.host.cost };
			}),
		results: () => Effect.forEach(state.viewers, (viewer) => viewer.results(), { concurrency: "unbounded" }),
	}),
});
export function viewers(count: number, queries: number) {
	return liveCost.trait("viewers", `${count} signed-in viewers each subscribe to ${queries} queries on one socket`, function* (state) {
		for (let viewer = 1; viewer <= count; viewer += 1) {
			const opened = yield* openViewer(state.host.url, viewer, queries);
			state.viewers.push(opened);
			state.initial.push(yield* opened.results());
		}
	});
}
