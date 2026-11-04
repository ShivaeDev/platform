import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit, Layer, Scope } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { Receipt } from "@shivaedev/agent/run.ts";
import type { PiOptions } from "#PiOptions.ts";
import { pi } from "#pi.ts";
import { installPeer, makePeer } from "#test/peer.ts";

export const piState = Effect.fnUntraced(function* () {
	const directory = yield* Effect.acquireRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "platform-pi-"))),
		(path) => Effect.promise(() => rm(path, { force: true, recursive: true })),
	);
	const scope = yield* Effect.acquireRelease(Scope.make(), (owned) => Scope.close(owned, Exit.void));
	const peer = makePeer(directory);
	installPeer(peer);
	const options: { value: PiOptions } = { value: { skills: [join(directory, "skills")] } };
	function connect() {
		return Effect.gen(function* () {
			const context = yield* Layer.build(pi(options.value));
			const backend = yield* Backend.pipe(Effect.provide(context));
			const agent = yield* requireFeatures(["sessions", "queuedInput", "steering", "interruption", "models"]).pipe(Effect.provide(context));
			return { agent, backend };
		});
	}
	const connection = { value: yield* connect() };
	return { connect, connection, directory, options, peer, receipts: new Map<string, Receipt>(), results: new Map<string, string>(), scope };
});
