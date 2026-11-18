---
"@shivaedev/admin": minor
---

### Added

- `UsersView`, `SessionsView` and `JobsView` take optional `locale` and `timeZone` props, a BCP 47 language tag and an IANA zone name, and show their times in them. Pass the values the application reads from identity's `AccountPreferences`; admin does not read them itself. A value the browser's `Intl` cannot read falls back to the browser's locale and time zone.

### Changed

- The Users, Sessions and Jobs views show each time as a date and a time with seconds and the zone's short name, such as `20 Oct 2026, 14:34:56 CEST`, in the browser's locale and time zone, instead of the raw ISO timestamp. The `<time>` element's `dateTime` attribute keeps the UTC instant in ISO form, and the job detail's Created, Started and Completed times are now `<time>` elements too. A test that reads the visible text of these times needs the new text, or the `dateTime` attribute for the instant.
