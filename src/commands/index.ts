import type { App } from 'slack.ts'
import { setupMessageHandler } from './message.ts'

export function registerCommands(app: App) {
	setupMessageHandler(app)
}
