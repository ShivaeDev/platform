import { Deferred, Effect, Schema } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { SocketCloseError, SocketOpenError } from "effect/socket/Socket";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Conflict, InternalServerError, NotFound, ServiceUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

class SubtitleRejected extends Schema.TaggedError<SubtitleRejected>()("SubtitleRejected", { message: Schema.String }) {}

export type Answer = "Conflict" | "Conflict on title" | "NotFound" | "Renamed" | "SubtitleRejected" | "Unauthorized";
export type Outage = "AuthUnavailable" | "InternalServerError" | "ServiceUnavailable";

const Rename = command("rename", {
	invalidates: () => [],
	payload: { title: Schema.String },
	rejections: { Conflict, NotFound, SubtitleRejected, Unauthorized },
	success: Schema.String,
});
const Note = query("note", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	rejections: { NotFound },
	success: Schema.String,
});
const Outline = query("outline", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	rejections: { ServiceUnavailable },
	success: Schema.String,
});
const Drafts = contract("failureDefaults", { commands: [Rename], queries: [Note, Outline] });

function rejection(answer: Exclude<Answer, "Renamed">) {
	switch (answer) {
		case "Conflict":
			return new Conflict({ message: "Someone else saved this draft" });
		case "Conflict on title":
			return new Conflict({ field: "title", message: "That title is taken" });
		case "NotFound":
			return new NotFound({ message: "The draft is gone" });
		case "SubtitleRejected":
			return new SubtitleRejected({ message: "The subtitle is too long" });
		case "Unauthorized":
			return new Unauthorized({ message: "Sign in to continue" });
	}
}

function outage(failure: Outage) {
	switch (failure) {
		case "AuthUnavailable":
			return new AuthUnavailable({ message: "Sign-in is unavailable right now" });
		case "InternalServerError":
			return new InternalServerError({ message: "The server could not finish the rename" });
		case "ServiceUnavailable":
			return new ServiceUnavailable({ message: "Drafts are down for maintenance" });
	}
}

export function failureClient() {
	const server: {
		answer: Answer;
		readonly heldOutage: Deferred.Deferred<void>;
		noteReads: number;
		outage: Outage | "over";
		readonly reread: Deferred.Deferred<void>;
	} = {
		answer: "Conflict",
		heldOutage: Deferred.makeUnsafe<void>(),
		noteReads: 0,
		outage: "ServiceUnavailable",
		reread: Deferred.makeUnsafe<void>(),
	};
	const handlers = Drafts.application.toLayer(
		Effect.succeed(
			Drafts.application.of({
				"failureDefaults.note": () => {
					server.noteReads += 1;
					return server.noteReads === 1
						? Effect.fail(new NotFound({ message: "Draft 7 is gone" }))
						: Effect.as(Deferred.await(server.reread), "Quarterly report");
				},
				"failureDefaults.outline": () => Effect.fail(new ServiceUnavailable({ message: "Outlines are down for maintenance" })),
				"failureDefaults.rename": () => (server.answer === "Renamed" ? Effect.succeed("Renamed") : Effect.fail(rejection(server.answer))),
			}),
		),
	);
	const connection = makeClient({ failureDefaults: Drafts }, { protocol: layerLiveMemoryProtocol(Drafts, handlers) });
	const api = connection.api.failureDefaults;
	return {
		api,
		// Custom operations stand in for a lost connection, a socket the host closed for an oversized message, a server outage, one that answers only when released, and a handler that dies.
		dies: {
			run: (_input: { readonly title: string }) => Effect.die(new Error("Database password rejected for user app")),
			runtime: connection.runtime,
		},
		heldOutage: {
			run: (_input: { readonly title: string }) => Effect.andThen(Deferred.await(server.heldOutage), Effect.fail(outage("ServiceUnavailable"))),
			runtime: connection.runtime,
		},
		note: api.note.query(),
		offline: {
			run: (_input: { readonly title: string }) =>
				Effect.fail(new RpcClientError({ reason: new SocketOpenError({ cause: "connect ECONNREFUSED 10.0.0.4:5432", kind: "Timeout" }) })),
			runtime: connection.runtime,
		},
		outline: api.outline.query(),
		server,
		tooLarge: {
			run: (_input: { readonly title: string }) => Effect.fail(new RpcClientError({ reason: new SocketCloseError({ closeReason: "", code: 1009 }) })),
			runtime: connection.runtime,
		},
		unavailable: {
			run: (_input: { readonly title: string }) => (server.outage === "over" ? Effect.void : Effect.fail(outage(server.outage))),
			runtime: connection.runtime,
		},
	};
}
export type FailureClient = ReturnType<typeof failureClient>;
