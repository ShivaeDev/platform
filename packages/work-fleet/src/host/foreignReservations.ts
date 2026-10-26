import { Effect, FileSystem, Schema } from "effect";
import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { boardSnapshot } from "#board/documents.ts";
import { fleetBranch, fleetPullRequest } from "#board/fleetField.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { FleetHost } from "#host/config.ts";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";

const ForeignPullRequest = Schema.Struct({
	head: Schema.Struct({ ref: Schema.String }),
	htmlUrl: Schema.String,
	state: Schema.Literals(["open", "closed"]),
}).pipe(Schema.encodeKeys({ htmlUrl: "html_url" }));

const readForeignPr = Effect.fn("FleetHost.readForeignPr")(function* (url: string) {
	const match = /^https:\/\/github\.com\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<number>[1-9]\d*)$/u.exec(url)?.groups;
	if (match === undefined) {
		return yield* new BadRequest({ message: "Foreign reservations require a GitHub PR URL" });
	}
	return yield* githubJson(ForeignPullRequest, (yield* GithubApi).get(`repos/${match.repository}/pulls/${match.number}`));
});

export const reserveForeignPr = Effect.fn("FleetHost.reserveForeignPr")(function* (host: FleetHost, url: string, fallbackAreas: readonly string[]) {
	const pr = yield* readForeignPr(url);
	const store = yield* FleetRepository;
	if (pr.state === "closed") {
		yield* store.releaseForeign(url);
		return;
	}
	const fs = yield* FileSystem.FileSystem;
	const snapshot = yield* boardSnapshot(host.boardDir, yield* fs.realPath(host.boardDir));
	for (const problem of snapshot.problems.values()) {
		return yield* problem;
	}
	const matches = snapshot.documents.filter(
		({ parsed }) =>
			parsed.fields.kind === "task"
			&& (fleetPullRequest(parsed) === pr.htmlUrl
				|| fleetBranch(parsed) === pr.head.ref
				|| (host.worker !== undefined && `${host.worker.branchPrefix}${parsed.fields.id}` === pr.head.ref)),
	);
	if (matches.length > 1) {
		return yield* new BadRequest({ message: `Several Board tasks match ${url}; select one task before reserving it` });
	}
	const areas = matches.length === 0 ? fallbackAreas : (matches[0]?.parsed.fields.areas ?? []);
	yield* store.reserveForeign(url, { backlog: true, executing: false }, areas);
});

export const refreshForeignReservations = Effect.fn("FleetHost.refreshForeignReservations")(function* () {
	const store = yield* FleetRepository;
	const failures: string[] = [];
	for (const reservation of yield* store.foreignReservations()) {
		if (!reservation.owner.startsWith("https://github.com/")) {
			continue;
		}
		const result = yield* readForeignPr(reservation.owner).pipe(Effect.result);
		if (result._tag === "Failure") {
			failures.push(`${reservation.owner}: ${result.failure.message}`);
		} else if (result.success.state === "closed") {
			yield* store.releaseForeign(reservation.owner);
		}
	}
	return failures;
});
