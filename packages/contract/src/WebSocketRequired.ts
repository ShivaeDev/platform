import { Schema } from "effect";

export class WebSocketRequired extends Schema.TaggedError<WebSocketRequired>()("WebSocketRequired", { message: Schema.String }) {}
