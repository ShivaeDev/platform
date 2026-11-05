import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { send } from "./send.ts";

export const Mailer = defineService({
	id: "@shivaedev/email/Mailer",
	initialize: Effect.void,
	methods: () => ({ send }),
	requires: [],
});
