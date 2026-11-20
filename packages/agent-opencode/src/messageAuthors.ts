import { Option, Schema } from "effect";
import { MessageUpdatedProperties } from "#MessageUpdatedProperties.ts";
export interface MessageAuthor {
	readonly model: string | undefined;
	readonly role: "agent" | "user";
}
export interface MessageAuthors {
	readonly of: (messageId: string) => Option.Option<MessageAuthor>;
	readonly record: (properties: unknown) => void;
}
const decodeMessage = Schema.decodeUnknownOption(MessageUpdatedProperties);
function modelOf(info: typeof MessageUpdatedProperties.Type.info, sessionModel: string | undefined) {
	return info.providerID === undefined || info.modelID === undefined ? sessionModel : `${info.providerID}/${info.modelID}`;
}
export function openMessageAuthors(sessionModel: string | undefined): MessageAuthors {
	const authors = new Map<string, MessageAuthor>();
	return {
		of: (messageId) => Option.fromNullishOr(authors.get(messageId)),
		record: (properties) => {
			Option.match(decodeMessage(properties), {
				onNone: () => undefined,
				onSome: ({ info }) => {
					authors.set(info.id, {
						model: modelOf(info, sessionModel),
						role: info.role === "user" ? "user" : "agent",
					});
				},
			});
		},
	};
}
