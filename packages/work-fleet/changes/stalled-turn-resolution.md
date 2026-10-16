### Fixed

- Retry and release can abandon a stalled provider turn even when it still reports running or no longer responds. Retry starts a fresh session, and abandoned turns cannot supply accepted output or late acknowledgements. Attempts retain the provider's last observation and interruption or observation failures in an optional `abandoned` field.
