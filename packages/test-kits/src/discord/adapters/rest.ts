import { Effect, Schema } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

const MessageBody = Schema.fromJsonString(Schema.Struct({ content: Schema.String }));

export const discordRest = Effect.fnUntraced(function* () {
	const messages = new Map<string, { "channel_id": string; content: string; id: string }>();
	let nextId = 1000;
	const server = yield* fakeHttpService({
		guard: (request) => request.headers.authorization === "Bot story-discord-token",
		routes: {
			create: {
				method: "POST",
				path: "/channels/:channel/messages",
				reply: (request) => {
					const body = Schema.decodeUnknownSync(MessageBody)(request.body.toString());
					nextId += 1;
					const message = { "channel_id": request.params.channel ?? "", content: body.content, id: String(nextId) };
					messages.set(message.id, message);
					return { body: message };
				},
			},
			edit: {
				method: "PATCH",
				path: "/channels/:channel/messages/:message",
				reply: (request) => {
					const message = messages.get(request.params.message ?? "");
					if (message === undefined || message.channel_id !== request.params.channel) {
						return { status: 404 };
					}
					message.content = Schema.decodeUnknownSync(MessageBody)(request.body.toString()).content;
					return { body: message };
				},
			},
			list: {
				method: "GET",
				path: "/channels/:channel/messages",
				reply: (request) => ({ body: [...messages.values()].filter((message) => message.channel_id === request.params.channel) }),
			},
			remove: {
				method: "DELETE",
				path: "/channels/:channel/messages/:message",
				reply: (request) => {
					messages.delete(request.params.message ?? "");
					return { status: 204 };
				},
			},
		},
	});
	return { server };
});
