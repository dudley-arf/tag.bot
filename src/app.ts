import { App, blocks, section, divider, button, input, plainTextInput, R } from 'slack.ts'
import { JsonKeyValueDatabase, type KeyValueDatabase } from './db/database.ts'

export interface AppWithDatabase extends App {
	database: KeyValueDatabase
}

export function createApp() {
	const app = new App({
		token: process.env.SLACK_BOT_TOKEN!,
		receiver: { type: 'socket', appToken: process.env.SLACK_APP_TOKEN! },
	}) as AppWithDatabase

	app.database = new JsonKeyValueDatabase({
		filePath: process.env.KV_DB_FILE ?? './data/kv.json',
	})

	app.on('home', async (event) => {
		console.log('Home opened by user:', event.user)
		const all = await app.database.getAll()
		const userId = event.user
		const userTags = Object.entries(all).filter(([, entry]) => entry.owner === userId)
		const totalTags = userTags.length
		const totalAccesses = userTags.reduce((sum, [, entry]) => sum + (entry.count ?? 0), 0)

		const tagBlocks = userTags.map(([key, entry]) =>
			section(`*${key}*\nCalled count: ${entry.count ?? 0}`)
				.id(key)
				.accessory(button('Edit').id('edit_tag_from_home'))
		)

		await event.respond({
			type: 'home',
			blocks: blocks(
				section(`You have ${totalTags} personal tags. Total accesses: ${totalAccesses}.`),
				divider(),
				...tagBlocks,
			),
		})
	})

	app.on('action.edit_tag_from_home', async (action) => {
		const key = action.block_id
		if (!key) return
		const entry = await app.database.get(key)
		if (!entry) return

		const modal = await action.respond.modal({
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
			return
		}

		await app.database.set(key, submittedValue, entry.owner)
	})

	return app
}

export async function startApp(app: AppWithDatabase) {
	await app.database.initialize()
	await app.start()
}
