import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { owner } from "@shivaedev/sql/owner.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { serverOnly } from "@shivaedev/sql/serverOnly.ts";

class Note extends Model.Class<Note>("OwnedDataNote")({
	id: Schema.Number,
	shareToken: serverOnly(Schema.String),
	title: Schema.String,
	userId: owner(Schema.String),
}) {}

class Bookmark extends Model.Class<Bookmark>("OwnedDataBookmark")({
	id: Schema.Number,
	title: Schema.String,
	userId: owner(Schema.NullOr(Schema.String)),
}) {}

// The host keeps one entry per model, so each owned table here has its own model as an application's would.
class Project extends Model.Class<Project>("OwnedDataProject")({ id: Schema.Number, userId: owner(Schema.String) }) {}
class Task extends Model.Class<Task>("OwnedDataTask")({ id: Schema.Number, userId: owner(Schema.String) }) {}
class Comment extends Model.Class<Comment>("OwnedDataComment")({ id: Schema.Number, userId: owner(Schema.String) }) {}
class Draft extends Model.Class<Draft>("OwnedDataDraft")({ id: Schema.Number, userId: owner(Schema.String) }) {}
class Revision extends Model.Class<Revision>("OwnedDataRevision")({ id: Schema.Number, userId: owner(Schema.String) }) {}
class Label extends Model.Class<Label>("OwnedDataLabel")({ id: Schema.Number, userId: owner(Schema.String) }) {}

class Memo extends Model.Class<Memo>("OwnedDataMemo")({ id: Schema.Number, text: Schema.String, userId: owner(Schema.String) }) {}

class Entry extends Model.Class<Entry>("OwnedDataEntry")({
	createdAt: Model.DateTimeInsertFromDate,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	listId: bucket(Schema.String),
	note: Schema.NullOr(Schema.String),
	userId: owner(Schema.String),
}) {}

class Forgotten extends Model.Class<Forgotten>("OwnedDataForgotten")({
	editorId: Schema.NullOr(Schema.String),
	id: Schema.Number,
	ownerId: owner(Schema.String),
}) {}

class AccountSettings extends Model.Class<AccountSettings>("OwnedDataAccountSettings")({
	ownerId: owner(Schema.String),
	theme: Schema.String,
}) {}

class Review extends Model.Class<Review>("OwnedDataReview")({
	id: Schema.Number,
	reviewerId: owner(Schema.String),
}) {}

// Building a repository is what reports its model to the host, as an application's Layers do at startup.
export const ownedModels = {
	accountSettings: Effect.asVoid(makeRepository(AccountSettings, { idColumn: "ownerId", tableName: "account_settings" })),
	archivedMemos: Effect.asVoid(makeRepository(Memo, { tableName: "archived_memos" })),
	bookmarks: Effect.asVoid(makeRepository(Bookmark, { tableName: "bookmarks" })),
	comments: Effect.asVoid(makeRepository(Comment, { tableName: "comments" })),
	drafts: Effect.asVoid(makeRepository(Draft, { tableName: "drafts" })),
	entries: Effect.asVoid(makeRepository(Entry, { collection: collection("entries", Schema.Number, { listId: Schema.String }) })),
	forgotten: Effect.asVoid(makeRepository(Forgotten, { tableName: "forgotten" })),
	labels: Effect.asVoid(makeRepository(Label, { tableName: "labels" })),
	memos: Effect.asVoid(makeRepository(Memo, { tableName: "memos" })),
	notes: Effect.asVoid(makeRepository(Note, { tableName: "notes" })),
	projects: Effect.asVoid(makeRepository(Project, { tableName: "projects" })),
	reviews: Effect.asVoid(makeRepository(Review, { tableName: "reviews" })),
	revisions: Effect.asVoid(makeRepository(Revision, { tableName: "revisions" })),
	tasks: Effect.asVoid(makeRepository(Task, { tableName: "tasks" })),
};
