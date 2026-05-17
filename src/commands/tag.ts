import type { App } from 'slack.ts'

export function setupTagCommand(app: App) {
	app.on('/tag', async (command) => {
		await command.respond.message({
			text: `Tag received: "${command.text}"`,
		})
	})
}
