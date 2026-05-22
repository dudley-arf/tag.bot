import { SlackTimeoutError } from 'slack.ts'

export function catchSlackTimeout<T, Args extends any[]>(
	fn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T | undefined> {
	return async (...args: Args): Promise<T | undefined> => {
		try {
			return await fn(...args)
		} catch (error) {
			if (error instanceof SlackTimeoutError) {
				console.warn('Ignored SlackTimeoutError:', error)
				return
			}
			throw error
		}
	}
}
