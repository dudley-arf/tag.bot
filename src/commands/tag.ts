import type { AppWithDatabase } from '../app.ts'

export function setupTagCommand(app: AppWithDatabase) {
	app.on('/create_tag', async (command) => {
		const text = (command.text || '').trim()
		if (!text) {
			return command.respond.message({ text: 'usage: `/create_tag <key> <value>`', ephemeral: true })
		}

		const [first, ...rest] = text.split(' ')

		if (typeof first === 'undefined' || first.trim() === '') {
			return command.respond.message({ text: 'Invalid key. Usage: `/create_tag <key> <value>`', ephemeral: true })
		}

		const key = first
		const value = rest.join(' ')

		if (value.trim() === '') {
			return command.respond.message({ text: 'Invalid value. Usage: `/create_tag <key> <value>`', ephemeral: true })
		}

		await app.database.set(key, value, command.user_id!)
		await command.respond.message({ text: `Created ${key}=${value}` })
	})

	app.on('/remove_tag', async (command) => {
		if (command.user_id !== process.env.BOT_OWNER_USER_ID) {
			return command.respond.message({ text: 'Only the bot owner can remove tags', ephemeral: true })
		}

		const text = (command.text || '').trim()
		if (!text) {
			return command.respond.message({ text: 'usage: `/remove_tag <key>`', ephemeral: true })
		}

		await app.database.delete(text)
		await command.respond.message({ text: `Removed ${text}` })
	})

	app.on('/get_tag', async (command) => {
		const text = (command.text || '').trim()
		if (!text) {
			return command.respond.message({ text: 'usage: `/get_tag <key>`', ephemeral: true })
		}
		const entry = await app.database.get(text)
		if (!entry) {
			await command.respond.message({ text: `Not found: ${text}` })
		} else {
			await command.respond.message({ text: `${text}=${entry.value}` })
		}
	})
}
