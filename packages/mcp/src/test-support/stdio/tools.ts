import { type FileHandle, open, writeFile } from "node:fs/promises";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";

export class ResourceFile extends Context.Service<ResourceFile, string>()("@shivaedev/mcp/test/ResourceFile") {}

export const ResourceAnswer = Schema.Struct({ text: Schema.String });

export function resourceFile(file: string) {
	return McpServer.middleware<{ provides: ResourceFile }>()((effect) => Effect.provideService(effect, ResourceFile, file));
}

const Tools = Toolkit.make(
	Tool.make("readResource", { dependencies: [ResourceFile], success: ResourceAnswer }),
	Tool.make("holdResource", { dependencies: [ResourceFile], success: ResourceAnswer }),
	Tool.make("resourceState", { parameters: Schema.Struct({ released: Schema.Boolean }), success: ResourceAnswer }),
);

const readResource = Effect.gen(function* () {
	const file = yield* ResourceFile;
	const handle = yield* Effect.acquireRelease(
		Effect.promise(() => open(file)),
		(resource) => Effect.promise(() => resource.close()),
	);
	return { text: yield* Effect.promise(() => handle.readFile("utf8")) };
}).pipe(Effect.scoped);

const holdResource = Effect.fnUntraced(function* (acquired: Deferred.Deferred<FileHandle>, released: Deferred.Deferred<void>) {
	const file = yield* ResourceFile;
	const handle = yield* Effect.acquireRelease(
		Effect.promise(() => open(file)),
		(resource) =>
			Effect.promise(async () => {
				await resource.close();
				await writeFile(`${file}.released`, "resource closed");
			}).pipe(Effect.andThen(Deferred.succeed(released, undefined))),
	);
	yield* Deferred.succeed(acquired, handle);
	return yield* Effect.never;
}, Effect.scoped);

export const resourceTools = Layer.unwrap(
	Effect.gen(function* () {
		const acquired = yield* Deferred.make<FileHandle>();
		const released = yield* Deferred.make<void>();
		const handlers = Tools.toLayer({
			holdResource: () => holdResource(acquired, released),
			readResource: () => readResource,
			resourceState: ({ released: waitForRelease }) =>
				Effect.gen(function* () {
					const handle = yield* Deferred.await(acquired);
					if (waitForRelease) {
						yield* Deferred.await(released);
					}
					return { text: handle.fd === -1 ? "closed" : "open" };
				}),
		});
		return McpServer.toolkit(Tools).pipe(Layer.provide(handlers));
	}),
);
