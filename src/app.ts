import { App } from 'slack.ts'
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

	return app
}

export async function startApp(app: AppWithDatabase) {
	await app.database.initialize()
	await app.start()
}
