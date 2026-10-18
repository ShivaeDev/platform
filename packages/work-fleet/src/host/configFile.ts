import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { HostConfig, HostConfigRejected, HostFailure, resolveHost } from "#host/config.ts";
import { CONFIG_FILE } from "#host/defaults.ts";

export const readHostConfig = Effect.fn("FleetHost.readHostConfig")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const text = yield* fs
		.readFileString(file)
		.pipe(Effect.mapError(() => new HostConfigRejected({ file, message: `Fleet host configuration is missing or unreadable: ${file}` })));
	const config = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(HostConfig))(text).pipe(
		Effect.mapError((error) => {
			const field = SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues[0]?.path?.map(String).join(".");
			return new HostConfigRejected({
				...(field === undefined || field === "" ? {} : { field }),
				file,
				message: `Fleet host configuration ${file} is invalid: ${error.message}`,
			});
		}),
	);
	if (config.provider === "cloud" && (config.cloud === undefined || config.worker === undefined)) {
		return yield* new HostConfigRejected({
			field: config.cloud === undefined ? "cloud" : "worker",
			file,
			message: `Fleet host configuration ${file} selects provider "cloud" without cloud and worker settings`,
		});
	}
	return config;
});

export const loadHost = Effect.fn("FleetHost.loadHost")(function* (board: string, configPath?: string) {
	const path = yield* Path.Path;
	const boardDir = path.resolve(board);
	const file = configPath === undefined ? path.join(boardDir, CONFIG_FILE) : path.resolve(configPath);
	const config = yield* readHostConfig(file).pipe(Effect.mapError((rejected) => new HostFailure({ message: rejected.message })));
	return resolveHost(boardDir, config, file);
});
