import type { AppWithDatabase } from '../app.ts'
// import { setupMessageHandler } from './message.ts'
import { setupTagCommand } from './tag.ts'

export function registerCommands(app: AppWithDatabase) {
	// setupMessageHandler(app)
	setupTagCommand(app)
}
