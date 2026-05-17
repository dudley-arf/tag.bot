import type { App } from 'slack.ts'
import { setupMessageHandler } from './message.ts'
import { setupTagCommand } from './tag.ts'

export function registerCommands(app: App) {
	setupMessageHandler(app)
	setupTagCommand(app)
}
