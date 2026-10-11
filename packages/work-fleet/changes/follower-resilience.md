### Fixed

- Daemon followers retain their last snapshot through transient PostgreSQL read failures and fail with a clear message after 20 consecutive attempts. The shared snapshot poller reads only while followers are subscribed and restarts with fresh state after becoming idle.
