import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { FleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { daemonHostOptions, daemonHttpLayer } from "#host/daemon.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { hostFixture } from "#test/fleetHost.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

const PR = "https://github.com/synthetic/project/pull/10";
const ENDPOINT = "repos/synthetic/project/pulls/10";

export const foreignAreaStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return yield* createForeignArea();
	},
	inspect: (state) => ({ requests: state.github.requests }),
	layer: postgresLayer,
	name: "foreign PR areas",
	runIf: postgresEnabled,
	stages: ["reservation"],
	verbs: foreignAreaVerbs,
});

export const createForeignArea = Effect.fn("FleetTest.createForeignArea")(function* () {
	const fixture = yield* hostFixture({}, { worker: { branchPrefix: "worker/", sharedEnvironment: "synthetic" } });
	const github = syntheticGithub();
	const context = yield* Layer.build(daemonHttpLayer(daemonHostOptions(fixture.host, { ...fixture.parts, github: github.layer }, 0)));
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP daemon");
	}
	return { context, fixture, github, port: address.port };
});

export function foreignAreaVerbs(state: Effect.Success<ReturnType<typeof createForeignArea>>, story: { readonly tell: (line: string) => void }) {
	const fleet = Context.get(state.context, Fleet);
	const store = Context.get(state.context, FleetRepository);
	return {
		admit: () => {
			story.tell("the host observes foreign PRs and admits approved Board work");
			return admitApproved(state.fixture.host).pipe(Effect.provide(state.context));
		},
		dispatch: (id: string) => {
			story.tell(`Fleet dispatches ${id}`);
			return dispatchApproved(state.fixture.host, id).pipe(Effect.provide(state.context), Effect.result);
		},
		get: (id: string) => fleet.get(id),
		launches: () => state.fixture.provider.launched,
		pr: (status: "open" | "closed" = "open", branch = "foreign/feature") => {
			story.tell(`GitHub reports ${PR} ${status} on ${branch}`);
			state.github.reply(ENDPOINT, { head: { ref: branch }, "html_url": PR, state: status });
		},
		prReadFails: () => {
			story.tell("GitHub cannot observe the foreign PR");
			state.github.reply(ENDPOINT, { message: "Unavailable" }, { status: 503 });
		},
		reservations: () => store.foreignReservations(),
		reserve: (areas: readonly string[] = []) => {
			story.tell(`reserve ${PR} through the CLI with ${areas.join(", ")}`);
			return Effect.promise(async () => {
				let stderr = "";
				const result = await cliProcess(
					["reserve-pr", PR, "--board", state.fixture.host.boardDir, "--port", String(state.port), ...areas.flatMap((area) => ["--areas", area])],
					{
						onError: (text) => {
							stderr += text;
						},
					},
				);
				return { ...result, stderr };
			});
		},
		task: (id: string, areas: readonly string[], metadata = "", approved = true) => {
			story.tell(`Board task ${id} claims ${areas.join(", ")}`);
			state.fixture.write(
				`${id}.md`,
				`---\nid: ${id}\nkind: task\n${approved ? "fleet: approved\n" : ""}areas: ${JSON.stringify(areas)}\n${metadata}---\n# ${id}\nDo the work.\n`,
			);
		},
	};
}
