import type { AppWithDatabase } from '../app.ts'
import type { SlashCommandInstance } from 'slack.ts'

function getUsageText() {
	return 'usage: `/t <key>` to read, `/t create <key> <value>` to create, `/t rm <key>` to remove. examples: `/t test`, `/t create test hello world`, `/t rm test`'
}

function parseTagArgs(text: string) {
	const trimmed = text.trim()
	const [action, ...rest] = trimmed.split(' ')
	return { action, rest }
}

async function handleGetTag(app: AppWithDatabase, command: SlashCommandInstance, key: string) {
	if (!key.trim()) {
		return command.respond.message({ text: 'Invalid key', ephemeral: true })
	}

	const entry = await app.database.get(key)
	return command.respond.message({
		text: entry ? `${key}=${entry.value}` : `Not found: ${key}`,
	})
}

async function handleCreateTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const key = rest[0]
	const value = rest.slice(1).join(' ')

	if (!key?.trim() || !value.trim()) {
		return command.respond.message({ text: 'usage: `/t create <key> <value>`', ephemeral: true })
	}

	await app.database.set(key, value, command.user_id!)
	return command.respond.message({ text: `Created ${key}=${value}` })
}

async function handleRemoveTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	if (command.user_id !== process.env.BOT_OWNER_USER_ID) {
		return command.respond.message({ text: 'Only the bot owner can remove tags', ephemeral: true })
	}

	const key = rest[0]
	if (!key?.trim()) {
		return command.respond.message({ text: 'usage: `/t rm <key>`', ephemeral: true })
	}

	await app.database.delete(key)
	return command.respond.message({ text: `Removed ${key}` })
}

export function setupTagCommand(app: AppWithDatabase) {
	app.on('/t', async (command) => {
		const text = (command.text || '').trim()
		if (!text) {
			return command.respond.message({ text: getUsageText(), ephemeral: true })
		}

		const { action, rest } = parseTagArgs(text)

		if (rest.length === 0) {
			if (typeof action === 'undefined' || action.trim() === '') {
				return command.respond.message({ text: getUsageText(), ephemeral: true })
			}
			return handleGetTag(app, command, action)
		}

		if (action === 'create') {
			return handleCreateTag(app, command, rest)
		}

		if (action === 'rm' || action === 'remove') {
			return handleRemoveTag(app, command, rest)
		}

		return command.respond.message({ text: getUsageText(), ephemeral: true })
	})
}
