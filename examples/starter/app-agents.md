# {{appName}}

This application runs on the ShivaeDev framework: Effect services and SQL on the server, native RPC contracts shared with React, and application-owned UI and authorization policy. Keep failures typed and preserve scope, interruption, transactions and authorization across boundaries. Prefer native Effect composition and the framework's existing APIs over a second path or helpers that hide them.

Shared declarations in the app and its modules stay browser safe. PostgreSQL, migrations and services belong in their server folders; screens, routing and forms belong in their client folders. The foundation composes the app host and router. Keep this app's dependency catalog and TypeScript configuration self-contained. The framework comes through `@shivaedev/platform`, and tests through `@shivaedev/test-story`: import each piece by its own name, list no piece beside the entry point that brings it, and keep `publicHoistPattern` in `pnpm-workspace.yaml`, which makes the pieces resolvable.

A server module exports a registration with `migrations` (its directory path), `group`, `handlers` and `services`. Register it in `src/server/modules.ts`; the foundation derives migrations from those registrations. Keep numbered migrations in the module’s server folder and use the next number across all modules.

Tests pass a single `replacements` Layer to `applicationHost` or `applicationWorker`. Compose fake ports with `Layer.mergeAll` and `Layer.succeed`; the host merges them over the real services. Replace `JobsClientFactory` through that Layer for controlled queue clients. Add ports as Effect services instead of adding one host option per port.

## React rendering

Decide what to render before the JSX. Quality reports `&&` and ternaries in JSX children, including nested decisions; conditional attributes such as `className` are accepted. Use an early return, a value computed above the return, or a small component that receives the data and returns `null`. Inside `.map`, extract an item component that makes its own decision.

Before: `<section>{ready && <Content />}</section>`. After:

```tsx
function Panel({ ready }) {
	if (!ready) return null;
	return (
		<section>
			<Content />
		</section>
	);
}
```

Before: `<section>{ready ? <Content /> : <Loading />}</section>`. After:

```tsx
function Panel({ ready }) {
	const content = ready ? <Content /> : <Loading />;
	return <section>{content}</section>;
}
```

Before: `<ul>{items.map(item => item.visible ? <li key={item.id}>{item.name}</li> : null)}</ul>`. After:

```tsx
function Item({ item }) {
	if (!item.visible) return null;
	return <li>{item.name}</li>;
}

function List({ items }) {
	return (
		<ul>
			{items.map((item) => (
				<Item key={item.id} item={item} />
			))}
		</ul>
	);
}
```

## Development

Run `pnpm run setup` after cloning to install dependencies and the pre-commit hook. Use `pnpm dev` to prepare the local databases and start development, `pnpm test` for the app's tests, `pnpm format` for formatting, and `pnpm ready` for lint, typecheck, build and tests. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create disposable test databases. A server change needs a real PostgreSQL and HTTP story; a form change needs a happy-dom story.

Write and review stories using the [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md), shipped by `@shivaedev/skills`. It is the source of the rules for observable evidence, boundary-driven setup, verbs and readouts, assertions, jobs, framework gaps, faked preconditions, database isolation and running one spec. Extend the kits in `src/test-support` with domain traits, actions and readouts.

The Quality baseline only goes down. Use `pnpm baseline write --rule <id>` only to record findings for a new rule added by a Quality upgrade. After fixing findings in changed files, run `pnpm baseline tighten`; use `pnpm baseline prune` to lower every entry across the app.

Read the [README](README.md) for setup and deployment, the [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for design boundaries, and the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the application workflow. Never skip the pre-commit hook or raise a quality baseline to make a check pass.
