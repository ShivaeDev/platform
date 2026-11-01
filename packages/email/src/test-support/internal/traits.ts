import { email } from "./email.ts";

export function rateLimited(header?: string) {
	return email.trait("provider", `Resend asks for Retry-After ${header}`, (engine) =>
		engine.mail.endpoint.scriptFault("send", {
			kind: "status",
			reply: {
				body: { message: "Rate limited", name: "rate_limit_exceeded", statusCode: 429 },
				headers: header === undefined ? {} : { "retry-after": header },
				status: 429,
			},
		}),
	);
}

export const unavailableTwice = email.trait("provider", "Resend fails the first two attempts", function* (engine) {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		yield* engine.mail.endpoint.scriptFault("send", {
			kind: "status",
			reply: { body: { message: "Unavailable", name: "internal_server_error", statusCode: 500 }, status: 500 },
		});
	}
});

export const rejected = email.trait("provider", "Resend rejects every attempt and echoes the secret link", function* (engine) {
	yield* engine.mail.endpoint.scriptFault(
		"send",
		{
			kind: "status",
			reply: { body: { message: "Rejected https://app.test/confirm?token=secret-link", name: "validation_error", statusCode: 422 }, status: 422 },
		},
		{ repeat: true },
	);
});

export const development = email.trait("provider", "the worker uses the development log mailer", (engine) => {
	engine.useLog = true;
});
