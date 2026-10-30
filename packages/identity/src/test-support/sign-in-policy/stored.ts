import type { AuthContext, BetterAuthOptions } from "better-auth";

export function storedPolicy<TOptions extends BetterAuthOptions>(auth: {
	readonly $context: Promise<Pick<AuthContext<TOptions>, "adapter" | "internalAdapter">>;
}) {
	async function storedUsers() {
		const { internalAdapter } = await auth.$context;
		const users = await internalAdapter.listUsers(1000, 0, { direction: "asc", field: "email" });
		return users.map(({ email }) => email);
	}
	async function sessionDevices(email: string) {
		const { internalAdapter } = await auth.$context;
		const user = await internalAdapter.findUserByEmail(email);
		if (user === null) {
			return [];
		}
		const held = await internalAdapter.listSessions(user.user.id);
		return held.map(({ userAgent }) => userAgent ?? "").sort((left, right) => left.localeCompare(right));
	}
	async function seedGitHubUsers(count: number, now: Date) {
		const { adapter } = await auth.$context;
		for (let index = 0; index < count; index += 1) {
			const user = await adapter.create<{ readonly id: string }>({
				data: { createdAt: now, email: `seeded-${index}@github.test`, emailVerified: true, name: `seeded ${index}`, updatedAt: now },
				model: "user",
			});
			await adapter.create({
				data: { accountId: String(5000 + index), createdAt: now, providerId: "github", updatedAt: now, userId: user.id },
				model: "account",
			});
			await adapter.create({
				data: { createdAt: now, expiresAt: new Date(now.getTime() + 3_600_000), token: `seeded-${index}`, updatedAt: now, userId: user.id },
				model: "session",
			});
		}
	}
	async function sessionHolders() {
		const { adapter } = await auth.$context;
		const held = await adapter.findMany<{ readonly userId: string }>({ limit: 1000, model: "session" });
		const users = await adapter.findMany<{ readonly email: string }>({
			model: "user",
			where: [{ field: "id", operator: "in", value: held.map(({ userId }) => userId) }],
		});
		return users.map(({ email }) => email).sort((left, right) => left.localeCompare(right));
	}
	return { seedGitHubUsers, sessionDevices, sessionHolders, storedUsers };
}
