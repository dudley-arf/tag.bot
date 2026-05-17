import { App } from 'slack.ts'

export function createApp() {
	return new App({
		token: process.env.SLACK_BOT_TOKEN!,
		receiver: { type: 'socket', appToken: process.env.SLACK_APP_TOKEN! },
	})
}
