import { createApp, startApp } from './src/app.ts'
import { registerCommands } from './src/commands/index.ts'

const app = createApp()

registerCommands(app)

await startApp(app)