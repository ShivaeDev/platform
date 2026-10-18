import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import superjson from "superjson";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/server/adapter.ts";
import { rejectWith } from "@shivaedev/effect-trpc/server/rejection.ts";
import { rejectionFormatter } from "@shivaedev/effect-trpc/server/rejectionFormatter.ts";
import { makeRequestServices } from "@shivaedev/effect-trpc/server/requestServices.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import {
	AuthUnavailable,
	BadRequest,
	Conflict,
	InternalServerError,
	NotFound,
	PreconditionFailed,
	ServiceUnavailable,
	TooManyRequests,
} from "#errors/taxonomy.ts";

const Rejection = Schema.Union([
	NotFound,
	BadRequest,
	Conflict,
	PreconditionFailed,
	TooManyRequests,
	AuthUnavailable,
	InternalServerError,
	ServiceUnavailable,
]);
const failures = {
	busy: new TooManyRequests({ message: "Slow down" }),
	internal: new InternalServerError({ message: "Internal server error" }),
	malformed: new BadRequest({ message: "Malformed" }),
	missing: new NotFound({ message: "No profile" }),
	outage: new AuthUnavailable({ message: "Sessions are unavailable" }),
	required: new BadRequest({ field: "name", message: "Name is required" }),
	stale: new PreconditionFailed({ message: "Profile changed" }),
	taken: new Conflict({ field: "name", message: "Name is taken" }),
	unavailable: new ServiceUnavailable({ message: "Storage is unavailable" }),
};

export const trpc = storyKit({
	clock: "live",
	*create() {
		const runtime = ManagedRuntime.make(Layer.empty);
		const t = initTRPC.create({ errorFormatter: rejectionFormatter, transformer: superjson });
		const procedure = makeEffectTRPC({ runtime }).procedure(
			t.procedure,
			makeRequestServices(() => Layer.empty),
		);
		const router = t.router({
			rename: procedure.input(Schema.Struct({ name: Schema.NonEmptyString })).mutation(function* ({ name }) {
				const failure = Object.entries(failures).find(([key]) => key === name)?.[1];
				return yield* (failure === undefined ? Effect.succeed(name) : Effect.fail(failure)).pipe(rejectWith(Rejection));
			}),
		});
		const client = createTRPCClient<typeof router>({
			links: [
				httpBatchLink({
					fetch: (input, init) =>
						fetchRequestHandler({
							createContext: () => ({}),
							endpoint: "/trpc",
							req: new Request(input, { ...init, signal: init?.signal ?? null }),
							router,
						}),
					transformer: superjson,
					url: "http://localhost/trpc",
				}),
			],
		});

		yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
		return client;
	},
	name: "tRPC rejection",
	stages: [],
	verbs: (client, story) => ({
		rename: (name: string) =>
			Effect.promise(async (): Promise<unknown> => {
				story.tell(`a caller renames a profile to ${JSON.stringify(name)} over tRPC HTTP`);
				try {
					return await client.rename.mutate({ name });
				} catch (error) {
					return error;
				}
			}),
	}),
});
export { Rejection };
