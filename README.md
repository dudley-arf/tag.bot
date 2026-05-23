# Tag Bot

A Slack Bot Slash that store text tags with built-in reminder scheduling and dynamic variable interpolation.

---

## Command Reference

| Command | Description |
| --- | --- |
| `/t <key>` | Fetch and post the content stored under a specific tag. |
| `/t create <key> <value>` | Save a new tag snippet. Supports dynamic variables. |
| `/t edit <key> <value>` | Update the content of an existing tag that you own. |
| `/t rm <key>` | Delete a tag from the workspace. |
| `/t info <key>` | View the original creator and raw, unformatted content of a tag. |
| `/t list` | Display a list of all tags created by you. |
| `/t find <query>` | Fuzzy search across the tags to find tags. |
| `/t reminder <key> <readable_time>` | Set a reminder to trigger a tag using human-readable time (e.g., `in 2 hours`, `tomorrow at 5pm`). |

---

## Dynamic Variables

When creating a tag, use the `{{VARIABLE_NAME}}` format to inject contextual metadata at runtime:

* `{{DATE}}`: Formats the current time using Slack's localized, user-specific magic date rendering (`<!date... >`).
* `{{USER_ID}}`: The raw Slack ID string of the user running the command (e.g., `U12345678`).
* `{{USER_PING}}`: Mentions/pings the calling user dynamically (e.g., `<@U12345678>`).
* `{{CHANNEL_ID}}`: The raw Slack channel ID string where the command was run.
* `{{CHANNEL_MENTION}}`: Generates a hyperlinked channel mention (e.g., `<#C12345678>`).

---

## Quick Examples

```text
/t create test test2
/t create ping-me Hi {{USER_PING}}!

/t test
/t reminder ping-me in 45 minutes

```

---

## How to run yourself

### 1. Environment Variables

Create a slack bot, and put `.env` file in the project root:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_USER_ID=U12345678
BOT_OWNER_USER_ID=U12345678
KV_DB_FILE=./data/kv.json

```

### 2. Run Application

Start the service using the pre-configured compose file:

```bash
docker compose up -d

```
