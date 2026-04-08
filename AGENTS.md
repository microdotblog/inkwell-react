# Inkwell

Inkwell is a React Native feed reader built with Expo. It reads RSS and JSON Feeds and syncs with Micro.blog, which follows a Feedbin-like API model.

## Product Concepts
The core product concepts are subscriptions, feeds, timeline entries, reader state, bookmarks, highlights, and feed filtering.
Prefer these terms consistently in code, comments, and UI copy.

## Expo
For Expo specific documentation and how-to's, reference https://docs.expo.dev/llms.txt.

## IMPORTANT! Reference Projects
Always check code styling and implementation patterns as per "./../strata" or "./../epilogue" for React Native code.
When instructions in those projects conflict with their live code, follow the implemented pattern in the reference project, not stale guidance.

`./../inkwell-web` is the primary reference for endpoint behavior, API semantics, domain naming, and user flows for timeline, reader, bookmarks, highlights, and subscriptions.
`./../inkwell-web/docs/feedbin/` contains Feedbin API documentation that is useful when implementing subscription, timeline, and entry behavior.

Use `./../strata` or `./../epilogue` for React Native implementation style.
Use `./../inkwell-web` for product behavior and data semantics.

Use `./../inkwell-mac` to reference the Mac app implementation for this app so that we align on styles.

Do not import notebook, posting, or notes concepts from Strata unless the feature truly requires them. Inkwell is a reader-first product.

## Code Style
@specs/STYLE.md

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Please clean up any files that you've created for testing or debugging purposes after they're no longer needed.
NEVER mention that Claude committed changes when creating git commits.
ALWAYS add a full stop at the end of a commit message.

ALWAYS read the full file before making any changes. ALWAYS make sure to correctly close code blocks. ALWAYS, at the end of your edits, make sure the file is correctly formatted and free of syntax errors, especially when dealing with nested structures, or code that was rewritten.
