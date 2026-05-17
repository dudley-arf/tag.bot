import type { App } from 'slack.ts'

export function setupMessageHandler(app: App) {
	app.on('message', async (message) => {
		if (message.user === process.env.SLACK_USER_ID) return
		await message.reply("I'm always listening :eyes:")
	})
}
