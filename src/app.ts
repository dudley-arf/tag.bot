import { App, blocks, section, divider, button, input, plainTextInput, actions } from 'slack.ts'
import { JsonKeyValueDatabase, type KeyValueDatabase } from './db/database.ts'
import { catchSlackTimeout } from './utils.ts'
import { type HomeView } from "@slack/types";

export interface AppWithDatabase extends App {
	database: KeyValueDatabase
}

async function getAppHomeView(app: AppWithDatabase, userId: string) : Promise<HomeView> {
	const all = await app.database.getAll()
	const userTags = Object.entries(all).filter(([, entry]) => entry.owner === userId)
	const totalTags = userTags.length
	const totalAccesses = userTags.reduce((sum, [, entry]) => sum + (entry.count ?? 0), 0)

	const tagBlocks = userTags.map(([key, entry]) =>
		section(`*${key}*\nCalled count: ${entry.count ?? 0}`)
			.id(key)
			.accessory(button('Edit').id('edit_tag_from_home'))
	)

	return {
		type: 'home',
		blocks: blocks(
			section(`You have ${totalTags} personal tags. Total accesses: ${totalAccesses}.`),
			actions(button('Add Tag').id('add_tag_from_home')),
			divider(),
			...tagBlocks,
		),
	}
}

export function createApp() {
	const app = new App({
		token: process.env.SLACK_BOT_TOKEN!,
		receiver: { type: 'socket', appToken: process.env.SLACK_APP_TOKEN! },
	}) as AppWithDatabase

	app.database = new JsonKeyValueDatabase({
		filePath: process.env.KV_DB_FILE ?? './data/kv.json',
	})

	app.on('home', catchSlackTimeout(async (event) => {
		console.log('Home opened by user:', event.user)
		await event.respond(await getAppHomeView(app, event.user))
	}))

	app.on('action.edit_tag_from_home', catchSlackTimeout(async (action) => {
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
		await app.request('views.publish', {
			user_id: entry.owner,
			view: await getAppHomeView(app, entry.owner)
		})
	}))

	app.on('action.add_tag_from_home', catchSlackTimeout(async (action) => {
		const modal = await action.respond.modal({
			type: 'modal',
			callback_id: 'create_tag_home',
			title: { type: 'plain_text', text: 'Create Tag' },
			submit: { type: 'plain_text', text: 'Create' },
			blocks: blocks(
				section('Please enter your new tag details below.'),
				input(plainTextInput().id('key')).id('key').label('Tag Name'),
				input(plainTextInput().id('value')).id('value').label('Tag Value'),
			),
		})

		const submission = await modal.wait.timeout(300_000).submit()
		const submittedKey = submission.values?.key?.key?.value ?? ''
		const submittedValue = submission.values?.value?.value?.value ?? ''
		if (!submittedKey.trim() || !submittedValue.trim()) {
			return
		}

		const userId = action.event.user.id
		await app.database.set(submittedKey, submittedValue, userId)
		await app.request('views.publish', {
			user_id: userId,
			view: await getAppHomeView(app, userId)
		})
	}))

	return app
}

export async function startApp(app: AppWithDatabase) {
	await app.database.initialize()
	await app.start()
}
