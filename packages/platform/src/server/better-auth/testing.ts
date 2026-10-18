import { testUtils } from "better-auth/plugins";

export function authTestUtils(options?: Parameters<typeof testUtils>[0]) {
	const plugin = testUtils(options);
	return {
		...plugin,
		init(context: Parameters<typeof plugin.init>[0]) {
			const result = plugin.init(context);
			// Remove this wrapper once Better Auth's testUtils omits undefined options.
			return result.options === undefined ? { context: result.context } : { context: result.context, options: result.options };
		},
	};
}

type TestContext = ReturnType<ReturnType<typeof authTestUtils>["init"]>["context"];

export async function signedInUser(auth: { readonly $context: Promise<TestContext> }, fields: Parameters<TestContext["test"]["createUser"]>[0]) {
	const { test } = await auth.$context;
	const user = await test.saveUser(test.createUser(fields));
	return test.login({ userId: user.id });
}
