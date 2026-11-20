import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, FileSystem, Layer, Option } from "effect";

export const hostHttpServices = Layer.unwrap(
	Effect.map(Effect.serviceOption(FileSystem.FileSystem), (fileSystem) =>
		Option.isSome(fileSystem)
			? Layer.merge(NodeHttpServer.layerHttpServices, Layer.succeed(FileSystem.FileSystem, fileSystem.value))
			: NodeHttpServer.layerHttpServices,
	),
);
