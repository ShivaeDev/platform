import { createServer } from "node:http";
import { PassThrough } from "node:stream";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { codexSockets } from "#test/codexSockets.ts";

export const socketStory = storyKit({
	create() {
		const lifecycle = codexSockets(createServer());
		const socket = new PassThrough();
		lifecycle.add(socket);
		return { lifecycle, socket };
	},
	name: "Codex socket lifecycle",
	stages: [],
	verbs: ({ lifecycle, socket }, story) => ({
		close: () => {
			story.tell("close the synthetic provider");
			return Effect.tryPromise(() => lifecycle.close());
		},
		peerError: (error: Error) => {
			story.tell("the peer socket emits an error");
			socket.emit("error", error);
		},
		socketCount: () => lifecycle.sockets.size,
	}),
});
