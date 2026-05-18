import { App, blocks, R, richText, section } from 'slack.ts'
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
			richText(R.section(`- ${key} (${entry.count ?? 0})`)),
		)

		await event.respond({
			type: 'home',
			blocks: blocks(
				richText(
					R.section(`You have ${totalTags} personal tags. Total accesses: ${totalAccesses}.`),
				),
				...tagBlocks,
			),
		})
	})

	return app
}

export async function startApp(app: AppWithDatabase) {
	await app.database.initialize()
	await app.start()
}
