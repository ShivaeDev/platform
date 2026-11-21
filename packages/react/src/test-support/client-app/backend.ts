import { Effect, Layer, Schema } from "effect";
import { RpcGroup } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

const tally = collection("client-app-tally", Schema.Number);

export const Counter = contract("counter", {
	commands: [command("bump", { invalidates: () => [tally.item(0)] })],
	queries: [query("count", { readPolicy: () => Effect.succeed(true), reads: () => [tally.item(0)], success: Schema.Number })],
});

export const Profile = contract("profile", {
	keyScope: "session",
	queries: [query("viewer", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

export interface Backend {
	count: number;
	countReads: number;
	viewer: string;
}

export function backendProtocol(backend: Backend) {
	const handlers = Layer.merge(
		Counter.application.toLayer({
			"counter.bump": () =>
				Effect.sync(() => {
					backend.count += 1;
				}),
			"counter.count": () =>
				Effect.sync(() => {
					backend.countReads += 1;
					return backend.count;
				}),
		}),
		Profile.application.toLayer({ "profile.viewer": () => Effect.sync(() => backend.viewer) }),
	);
	return layerLiveMemoryProtocol(RpcGroup.make().merge(Counter, Profile), handlers);
}
