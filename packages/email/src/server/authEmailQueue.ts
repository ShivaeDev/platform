import { Config, Effect, Record, Redacted } from "effect";
import type { AuthEmail, BetterAuthEmails } from "@shivaedev/identity/server/better-auth/emails.ts";
import { type AuthEmailJob, authEmailJobs } from "#authEmailJobs.ts";
import type { Email } from "#Email.ts";
import { type AuthEmailCopies, type AuthEmailCopy, type AuthEmailKind, defaultAuthEmailCopy } from "#server/authEmailCopy.ts";
import { defineEmailQueue } from "#server/defineEmailQueue.ts";

export interface AuthEmailLayoutParts {
	readonly action: { readonly href: string; readonly label: string };
	readonly body: string;
	readonly footer?: string;
	readonly subject: string;
}

export type AuthEmailLayout = (parts: AuthEmailLayoutParts) => string;

export interface AuthEmailQueueOptions extends Pick<BetterAuthEmails, "window" | "windows"> {
	readonly copy?: Partial<AuthEmailCopies>;
	readonly layout?: AuthEmailLayout;
	readonly paths: Readonly<Record<AuthEmailKind, string>>;
}

// A production host without PUBLIC_URL would mail links to the development origin, so production refuses to start without it.
const publicUrl = Effect.gen(function* () {
	const environment = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
	const url = Config.URL("PUBLIC_URL");
	return yield* environment === "production" ? url : url.pipe(Config.withDefault(new URL("http://127.0.0.1:5173")));
});
const sender = Config.String("EMAIL_FROM").pipe(Config.withDefault("Accounts <onboarding@resend.dev>"));

export function authEmailQueue({ copy, layout = defaultLayout, paths, ...windows }: AuthEmailQueueOptions) {
	const copies: AuthEmailCopies = { ...defaultAuthEmailCopy, ...copy };
	const queue = defineEmailQueue(
		authEmailJobs.schema,
		(message) => Effect.map(sender, (from) => render(from, message, copies, layout)),
		authEmailJobs,
	);
	const emails = Effect.gen(function* () {
		const origin = yield* publicUrl;
		const jobs = yield* queue.Jobs;
		return {
			...windows,
			deliver: (message) =>
				jobs.enqueue(queue.queue, job(message)).pipe(
					Effect.asVoid,
					Effect.mapError(() => ({ code: "EMAIL_UNAVAILABLE", message: "Could not queue the authentication email" })),
				),
			routes: Record.map(paths, (path) => new URL(path, origin).href),
		} satisfies BetterAuthEmails;
	});
	const registration = {
		queues: [queue.queue],
		services: queue.producerLayer,
		workers: queue.workerLayer,
	};
	return { emails, registration };
}

function job(message: AuthEmail): AuthEmailJob {
	switch (message._tag) {
		case "ApproveEmailChange":
			return { kind: message._tag, newEmail: message.newEmail, to: message.user.email, url: message.url };
		case "ConfirmNewAddress":
			return { kind: message._tag, to: message.newEmail, url: message.url };
		default:
			return { kind: message._tag, to: message.user.email, url: message.url };
	}
}

function copyFor<TKind extends AuthEmailKind>(copies: AuthEmailCopies, kind: TKind, message: AuthEmailJob & { readonly kind: TKind }) {
	return copies[kind](message);
}

function escapeHtml(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function defaultLayout({ action, body, footer }: AuthEmailLayoutParts) {
	const opening = body === "" ? [] : [body];
	const closing = footer === undefined ? [] : [`<p>${footer}</p>`];
	return [...opening, `<p><a href="${action.href}">${action.label}</a></p>`, ...closing].join("\n");
}

function render(from: string, message: AuthEmailJob, copies: AuthEmailCopies, layout: AuthEmailLayout): Email {
	const { action, footer, lines, subject }: AuthEmailCopy = copyFor(copies, message.kind, message);
	const url = Redacted.value(message.url);
	const closing = footer === undefined ? [] : [footer];
	const text = [...lines, "", `${action}: ${url}`, ...closing.flatMap((line) => ["", line])].join("\n");
	const html = layout({
		action: { href: escapeHtml(url), label: escapeHtml(action) },
		body: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n"),
		...(footer === undefined ? {} : { footer: escapeHtml(footer) }),
		subject: escapeHtml(subject),
	});
	return { from, html, subject, text, to: message.to };
}
