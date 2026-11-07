import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { send } from "#server/log-mailer/send.ts";

export const Mailer = defineService({
	id: "@shivaedev/email/Mailer",
	initialize: Effect.void,
	methods: () => ({ send }),
	requires: [],
});
