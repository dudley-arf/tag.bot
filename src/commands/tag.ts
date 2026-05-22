import type { AppWithDatabase } from '../app.ts'
import { blocks, mrkdwn, section, input, plainTextInput, type SlashCommandInstance } from 'slack.ts'
import Fuse from 'fuse.js'
import {type FuseResult} from 'fuse.js';
import { catchSlackTimeout } from '../utils.ts';



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

function resolveVariable(name: string, command: SlashCommandInstance): string {
	if (name === 'DATE') {
		const timestamp = Math.floor(Date.now() / 1000)
		const fallback = new Date().toISOString()
		const tokenString = '{date_num} {time_secs}'
		return `<!date^${timestamp}^${tokenString}|${fallback}>`
	}
	if (name === 'USER_ID') {
		return command.user_id ?? ''
	}
	if (name === 'USER_PING') {
		return command.user_id ? `<@${command.user_id}>` : ''
	}
	if (name === 'CHANNEL_ID') {
		return command.channel_id ?? ''
	}
	if (name === 'CHANNEL_MENTION') {
		return command.channel_id ? `<#${command.channel_id}>` : ''
	}
	return `{{${name}}}`
}

function resolveVariables(content: string, command: SlashCommandInstance): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, name) => resolveVariable(name, command))
}

function getUsageText() {
	return 'Usage: `/t <key>` to read\n`/t create <key> <value>` to create\n`/t edit <key> <value>` to edit\n`/t rm <key>` to remove\n`/t info <key>` to show creator and raw content\n`/t list` to list all your tags\n`/t find <query>` to search tags'
}

async function handleListTag(app: AppWithDatabase, command: SlashCommandInstance) {
	const keys = await app.database.listByOwner(command.user_id)
	if (keys.length === 0) {
		return command.respond.message({ text: 'You have no tags defined.', ephemeral: true })
	}
	const formatted = keys.map((k) => `- ${k}`).join('\n')
	return command.respond.message({ text: `Your tags:\n${formatted}` })
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

	await app.database.incrementCount(key)
	const resolvedValue = resolveVariables(entry.value, command)
	return command.respond.message({ blocks: blocks(section(mrkdwn(resolvedValue))) })
}

async function handleCreateTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const key = rest[0]
	let value = rest.slice(1).join(' ')

	if (!key?.trim()) {
		return command.respond.message({ text: 'usage: `/t create <key> <value>`', ephemeral: true })
	}

	if (!value.trim()) {
		const modal = await command.respond.modal({
			type: 'modal',
			callback_id: 'tag_value',
			private_metadata: key,
			title: { type: 'plain_text', text: 'Create Tag' },
			submit: { type: 'plain_text', text: 'Create' },
			blocks: blocks(
				section('Please enter your tag value below.'),
				input(plainTextInput().id('value')).id('value').label('Tag Value'),
			),
		})
		const submission = await modal.wait.timeout(300_000).submit()
		const submittedValue = submission.values?.value?.value?.value ?? ''
		if (!submittedValue.trim()) {
			return command.respond.message({ text: 'Tag value cannot be empty.', ephemeral: true })
		}
		value = submittedValue
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
	let value = rest.slice(1).join(' ')

	if (!key?.trim()) {
		return command.respond.message({ text: 'usage: `/t edit <key> <value>`', ephemeral: true })
	}

	const entry = await app.database.get(key)
	if (!entry) {
		return command.respond.message({ text: `Not found: ${key}`, ephemeral: true })
	}

	if (!(await canChangeTag(app, command.user_id, key))) {
		return command.respond.message({ text: 'Only the bot owner or the tag creator can edit tags', ephemeral: true })
	}

	if (!value.trim()) {
		const modal = await command.respond.modal({
			type: 'modal',
			callback_id: 'tag_value',
			private_metadata: key,
			title: { type: 'plain_text', text: 'Edit Tag' },
			submit: { type: 'plain_text', text: 'Save' },
			blocks: blocks(
				section('Please edit the tag value below.'),
				input(plainTextInput().id('value').default(entry.value)).id('value').label('Tag Value'),
			),
		})
		const submission = await modal.wait.timeout(300_000).submit()
		const submittedValue = submission.values?.value?.value?.value ?? ''
		if (!submittedValue.trim()) {
			return command.respond.message({ text: 'Tag value cannot be empty.', ephemeral: true })
		}
		value = submittedValue
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

async function handleInfoTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const key = rest[0]
	if (!key?.trim()) {
		return command.respond.message({ text: 'usage: `/t info <key>`', ephemeral: true })
	}

	const entry = await app.database.get(key)
	if (!entry) {
		return command.respond.message({ text: `Not found: ${key}`, ephemeral: true })
	}

	const creator = entry.owner || 'unknown'
	const raw = entry.value
	const count = entry.count ?? 0
	return command.respond.message({
		text: `Tag: ${key}\nCreator: ${creator}\nCalled Count: ${count}\nRaw:\n\`\`\`\n${raw}\n\`\`\``,
	})
}

async function handleFindTag(app: AppWithDatabase, command: SlashCommandInstance, rest: string[]) {
	const query = rest.join(' ').trim()
	if (!query) {
		return command.respond.message({ text: 'usage: `/t find <query>`', ephemeral: true })
	}

	const all = await app.database.getAll()
	const items = Object.entries(all).map(([key, entry]) => ({ key, value: entry.value }))
	const exactMatches = items.filter(item => 
		item.key.toLowerCase().includes(query.toLowerCase()) || 
		item.value.toLowerCase().includes(query.toLowerCase())
	)

	const fuse = new Fuse(items, { keys: ['key', 'value'], includeScore: true, threshold: 0.4 })
	const fuzzyResults: FuseResult<{ key: string; value: string }>[] = fuse.search(query).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))

	const seen = new Set<string>()
	const results = []

	for (const item of exactMatches) {
		if (!seen.has(item.key) && results.length < 10) {
			results.push(item)
			seen.add(item.key)
		}
	}

	for (const result of fuzzyResults) {
		if (!seen.has(result.item.key) && results.length < 10) {
			results.push(result.item)
			seen.add(result.item.key)
		}
	}

	if (results.length === 0) {
		return command.respond.message({ text: `No tags found for "${query}"` })
	}

	const lines = results.map(item => `• ${item.key} = ${item.value}`)
	return command.respond.message({ text: `*Search results:*\n${lines.join('\n')}` })
}

export function setupTagCommand(app: AppWithDatabase) {

	app.on('/t', catchSlackTimeout(async (command) => {
		const text = (command.text || '').trim()
		console.log('Received /t command with text:', text)
		if (!text) {
			return command.respond.message({ text: getUsageText(), ephemeral: true })
		}

		const { action, rest } = parseTagArgs(text)

		if (rest.length === 0) {
			if (action === 'list') {
				return handleListTag(app, command)
			}

			if (typeof action === 'undefined' || action.trim() === '') {
				return command.respond.message({ text: getUsageText(), ephemeral: true })
			}
			return handleGetTag(app, command, action)
		}

		if (action === 'find') {
			return handleFindTag(app, command, rest)
		}

		if (action === 'list') {
			return command.respond.message({ text: getUsageText(), ephemeral: true })
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

		if (action === 'info') {
			return handleInfoTag(app, command, rest)
		}

		return command.respond.message({ text: getUsageText(), ephemeral: true })
	}))
}
