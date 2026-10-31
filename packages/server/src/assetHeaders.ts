import { Effect, Path } from "effect";
import type { AssetOptions } from "#AssetOptions.ts";

function documentHeaders(options: AssetOptions): Record<string, string> {
	const headers: Record<string, string> = {};
	const ancestors = options.documentHeaders?.frameAncestors ?? "'none'";
	const frames = options.documentHeaders?.xFrameOptions ?? "DENY";
	if (ancestors !== false) {
		headers["content-security-policy"] = `frame-ancestors ${ancestors}`;
	}
	if (frames !== false) {
		headers["x-frame-options"] = frames;
	}
	return headers;
}

export const assetHeaders = Effect.fnUntraced(function* (options: AssetOptions, file: string, pathname: string) {
	const path = yield* Path.Path;
	const extension = path.extname(file).slice(1).toLowerCase();
	const contentType = options.mimeTypes?.[extension] ?? (extension === "html" || extension === "htm" ? "text/html" : "");
	const document = contentType.split(";")[0]?.trim().toLowerCase() === "text/html";
	const fingerprinted = /[.-](?:[a-f0-9]{8,}|(?=[A-Za-z0-9_-]*[A-Z0-9])[A-Za-z0-9_-]{8,})\.[^.]+$/u.test(path.basename(file));
	const assetCache = fingerprinted ? "public, max-age=31536000, immutable" : "no-cache";
	const defaultCache = document ? "no-store" : assetCache;
	const override = typeof options.cacheControl === "function" ? options.cacheControl(pathname) : options.cacheControl;
	return { ...(document ? documentHeaders(options) : {}), "cache-control": override ?? defaultCache };
});
