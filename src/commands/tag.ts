import type { AppWithDatabase } from '../app.ts'
import type { SlashCommandInstance } from 'slack.ts'



const reservedKeywords = ['create', 'edit', 'rm', 'remove']
const blacklistWords: string[] = []
const blacklistPatterns: RegExp[] = [/<!channel(\|[^>\|\r\n]*)?>/i, /<!here(\|[^>\|\r\n]*)?>/i]

function checkBlacklist(content: string) {
	const normalized = content.trim()
	if (!normalized) {
		return false
	}

	if (blacklistWords.some((word) => normalized.toLowerCase().includes(word))) {
		return true
	}

	return blacklistPatterns.some((pattern) => pattern.test(content))
}

function resolveVariable(name: string): string {
	if (name === 'DATE') {
		return new Date().toISOString()
	}
	return `{{${name}}}`
}

function resolveVariables(content: string): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, name) => resolveVariable(name))
}

function getUsageText() {
	return 'Usage: `/t <key>` to read\n`/t create <key> <value>` to create\n`/t edit <key> <value>` to edit\n`/t rm <key>` to remove'
}

function parseTagArgs(text: string) {
	const trimmed = text.trim()
	const [action, ...rest] = trimmed.split(' ')
	return { action, rest }
}

async function canChangeTag(app: AppWithDatabase, userId: string | undefined, key: string) {
	if (!userId || !key.trim()) {
		return false
	}

	if (userId === process.env.BOT_OWNER_USER_ID) {
		return true
	}

	const entry = await app.database.get(key)
	return entry?.owner === userId
}


async function handleGetTag(app: AppWithDatabase, command: SlashCommandInstance, key: string) {
	if (!key.trim()) {
		return command.respond.message({ text: 'Invalid key', ephemeral: true })
	}

	const entry = await app.database.get(key)
	if (!entry) {
		return command.respond.message({ text: `Not found: ${key}` })
	}

	const resolvedValue = resolveVariables(entry.value)
	return command.respond.message({
		text: `${resolvedValue}`,
	})
}

async function handleCreateTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const key = rest[0]
	const value = rest.slice(1).join(' ')

	if (!key?.trim() || !value.trim()) {
		return command.respond.message({ text: 'usage: `/t create <key> <value>`', ephemeral: true })
	}

	if (reservedKeywords.includes(key)) {
		return command.respond.message({ text: 'That key is reserved and cannot be created', ephemeral: true })
	}

	if (checkBlacklist(value)) {
		return command.respond.message({ text: 'That tag value contains a blocked word or pattern', ephemeral: true })
	}

	await app.database.set(key, value, command.user_id!)
	return command.respond.message({ text: `Created ${key}=${value}` })
}


async function handleEditTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const key = rest[0]
	const value = rest.slice(1).join(' ')

	if (!key?.trim() || !value.trim()) {
		return command.respond.message({ text: 'usage: `/t edit <key> <value>`', ephemeral: true })
	}

	const entry = await app.database.get(key)
	if (!entry) {
		return command.respond.message({ text: `Not found: ${key}`, ephemeral: true })
	}

	if (!(await canChangeTag(app, command.user_id, key))) {
		return command.respond.message({ text: 'Only the bot owner or the tag creator can edit tags', ephemeral: true })
	}

	if (checkBlacklist(value)) {
		return command.respond.message({ text: 'That tag value contains a blocked word or pattern', ephemeral: true })
	}

	await app.database.set(key, value, entry.owner)
	return command.respond.message({ text: `Edited ${key}=${value}` })
}

async function handleRemoveTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {

	const key = rest[0]
	if (!key?.trim()) {
		return command.respond.message({ text: 'usage: `/t rm <key>`', ephemeral: true })
	}

	if (!(await canChangeTag(app, command.user_id, key))) {
		return command.respond.message({ text: 'Only the bot owner or the tag creator can remove tags', ephemeral: true })
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

		if (action === 'edit') {
			return handleEditTag(app, command, rest)
		}

		if (action === 'rm' || action === 'remove') {
			return handleRemoveTag(app, command, rest)
		}

		return command.respond.message({ text: getUsageText(), ephemeral: true })
	})
}
