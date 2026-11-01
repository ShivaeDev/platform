import { Effect, type FileSystem, PlatformError } from "effect";

function fileFailure(tag: "Unknown" | "PermissionDenied", method: string, path: string, description: string) {
	return Effect.fail(PlatformError.systemError({ _tag: tag, description, method, module: "FileSystem", pathOrDescriptor: path }));
}

export function draftWriteFails(fs: FileSystem.FileSystem): FileSystem.FileSystem {
	return {
		...fs,
		writeFileString: (path, contents, options) =>
			path.endsWith(".draft")
				? fs
						.writeFileString(path, contents.slice(0, 10), options)
						.pipe(Effect.andThen(fileFailure("Unknown", "writeFileString", path, "disk full after a partial draft write")))
				: fs.writeFileString(path, contents, options),
	};
}

export function cleanupFails(fs: FileSystem.FileSystem, lock: string, resource: "draft" | "lock" | "gate"): FileSystem.FileSystem {
	return {
		...fs,
		remove: (path, options) =>
			(resource === "draft" ? path.endsWith(".draft") : path === (resource === "gate" ? `${lock}.reclaim` : lock))
				? fileFailure("PermissionDenied", "remove", path, `cannot remove the ${resource}`)
				: fs.remove(path, options),
	};
}
