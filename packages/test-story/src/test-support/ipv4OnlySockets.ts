import { isIP, Server } from "node:net";
import { Effect } from "effect";
import { vi } from "vitest";

export const ipv4OnlySockets = Effect.acquireRelease(
	Effect.sync(() => {
		const listen = Server.prototype.listen;
		return vi.spyOn(Server.prototype, "listen").mockImplementation(function (this: Server, ...args) {
			const options: unknown = args[0];
			let host: unknown = args[1];
			if (typeof options === "object" && options !== null && "host" in options) {
				host = options.host;
			}
			if (typeof host === "string" && isIP(host) === 6) {
				throw Object.assign(new Error("IPv6 is unavailable in this container"), { code: "EAFNOSUPPORT" });
			}
			return Reflect.apply(listen, this, args);
		});
	}),
	(mock) => Effect.sync(() => mock.mockRestore()),
);
