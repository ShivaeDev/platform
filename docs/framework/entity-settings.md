# Typed settings attached to an entity

Give an entity's settings a successful query value even before the first save. A screen then uses the same editor for defaults and stored values: it never creates a placeholder row or handles a missing-settings state. The application still owns authorization and validation policy.

This recipe uses Schema, a `sql` repository, a query and a command in a defined module from `contract`, and a `react` editor over `form` fields. It adds no framework helper. The files follow the layout of a module in the [feature guide](./add-a-feature.md): the schemas in `model.ts`, the repositories and operations in `server/`.

## Declare defaults once

The settings Schema in `model.ts` owns the defaults:

```ts
export const Settings = Schema.Struct({
	pageSize: Schema.Number.pipe(Schema.withDecodingDefaultKey(Effect.succeed(25))),
	title: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("Workspace"))),
});
export const EntityId = Schema.Struct({ entityId: Schema.Number });
export const EntitySettings = Schema.Struct({ ...EntityId.fields, ...Settings.fields });
export class InvalidSettings extends Schema.TaggedError<InvalidSettings>()("InvalidSettings", fieldRejection(Settings)) {}
export const settings = collection("entity-settings", Schema.Number);
```

`EntitySettings` adds `entityId` to those fields and is the save command's payload. The settings row's model reuses them; the form reuses the title field and replaces only the number's input codec with `Schema.NumberFromString`. Defaults come from decoding an empty object with `Settings`, rather than a separate defaults object in the component or the operation.

## Read an authorized entity, then its settings

Both operations first load the entity and check its owner against the request's user, through one function beside them:

```ts
export const ownedEntity = Effect.fn("Settings.ownedEntity")(function* (entityId: number) {
	const { id: ownerId } = yield* Identity;
	const entity = yield* (yield* EntitiesRepository).findOne({ where: { id: entityId, ownerId } });
	if (Option.isNone(entity)) {
		return yield* new NotFound({ message: "Entity not found" });
	}
	return entity.value;
});
```

An unknown or unowned entity answers `NotFound`, including when it has no settings row. Only an authorized entity reaches the settings lookup:

```ts
export const Get = query("get", {
	payload: EntityId,
	reads: ({ entityId }) => [settings.item(entityId)],
	*run({ entityId }) {
		yield* ownedEntity(entityId);
		const stored = yield* (yield* SettingsRepository).findOne({ where: { entityId } });
		const { pageSize, title } = Option.isSome(stored) ? stored.value : yield* Schema.decodeUnknownEffect(Settings)({});
		return { entityId, pageSize, title };
	},
});
```

When no settings row exists, `run` decodes `Settings` from `{}` and returns those defaults with the entity id, so the query succeeds with the same shape in either case. A database or decoding failure fails the query; it never becomes the defaults.

The migration makes `entity_settings."entityId"` both a primary key and a foreign key to the entity. The settings repository is `makeRepository(SettingsRow, { conflictColumns: ["entityId"], idColumn: "entityId", tableName: "entity_settings" })`, so the same entity cannot accumulate duplicate settings rows. Reading defaults writes nothing.

## Save through an explicit upsert

After authorization and application validation, the command saves with the repository's conflict operation:

```ts
export const Save = command("save", {
	invalidates: ({ entityId }) => [settings.item(entityId)],
	payload: EntitySettings,
	*run(input) {
		yield* ownedEntity(input.entityId);
		if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
			return yield* new InvalidSettings({ field: "pageSize", message: "Choose between 1 and 100 rows" });
		}
		const { row } = yield* (yield* SettingsRepository).upsert(input, { updateColumns: ["title", "pageSize"] });
		return { entityId: row.entityId, pageSize: row.pageSize, title: row.title };
	},
});
```

The first save inserts a row; later saves update the named settings columns at the same entity id. `updateColumns` deliberately excludes the identity. The command declares `settings.item(entityId)` as its invalidation key, and the query declares the same key as a read dependency; the host publishes it after the command succeeds. A single upsert commits on its own, so the command needs no `transact`.

The module lists both operations under identity's `Authenticated` middleware, which supplies `Identity`, and its registration provides the two repositories. Each mounted editor subscribes through the session's WebSocket connection and receives its first authorized settings result there. A committed settings change makes the socket process rerun each affected subscription under its current session and read policy and push the changed value into its already-open editor. The client issues no follow-up read. See [live updates](./live-updates.md) for server coalescing and reconciliation.

## Edit fields and keep typed failures

The editor binds the generated contract's save command to the query. `settings` is the module's binding, which the module's client registration takes from its record client as `client.api.settings`, as the [feature guide](./add-a-feature.md#6-register-the-client-module-and-route) shows:

```ts
const Draft = Schema.Struct({ pageSize: Schema.NumberFromString, title: Schema.String });

const editor = useEditor(settings.save, { fields: Draft, fixed: { entityId }, query: settings.get.query({ entityId }) });
```

`Draft` holds the page size as text, and the editor encodes each queried row with it. Each control uses form's `useField`; submit calls `editor.save()`. A missing row needs no special form branch because the query already supplies defaults. The editor shows the queried value as well as its editable draft.

`InvalidSettings` is a field rejection over the settings fields, so the generator lists it among the command's rejections and `useEditor` puts its message on the `pageSize` field without a `failures` handler. The rejected draft stays visible and no settings row is stored. This range is application policy, enforced by the command for every caller, not only for form submissions.

## What the evidence covers

React's settings stories prove this recipe against real PostgreSQL over real HTTP, with saves committed through `appHost` and observed by independently rendered clients: defaults without a stored row, first-save creation and its live delivery to the other client, replacement values that leave exactly one stored row, no row or new values visible before commit, a field rejection that stores nothing, and refusal of another owner's queries and saves before and after the row exists. Their fixture declares the same two operations without `run` and serves them with hand-written handlers, its bearer-token sessions and permissive Origin policy are fixture choices, and the clients are DOM renders, so they do not prove browser appearance, SSR or a production sign-in flow.
