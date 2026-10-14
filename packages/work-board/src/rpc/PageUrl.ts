import { Schema } from "effect";

export const PageUrl = Schema.String.check(
	Schema.isMaxLength(8192),
	Schema.makeFilter((value) => {
		if (!value.startsWith("/") || value.startsWith("//")) {
			return "Expected a local reading URL";
		}
		try {
			const path = new URL(value, "http://127.0.0.1").pathname;
			return (
				path === "/"
				|| [
					"/_board/inbox",
					"/_board/diagnostics",
					"/_board/work",
					"/_board/overview",
					"/_board/changes",
					"/_board/start",
					"/_board/respond",
					"/_board/handoff",
					"/_board/result",
				].includes(path)
				|| /^\/_board\/item\/[^/]+\/$/u.exec(path) !== null
				|| /\.md$/iu.exec(path) !== null
				|| "Expected a local reading URL"
			);
		} catch {
			return "Expected a local reading URL";
		}
	}),
);
