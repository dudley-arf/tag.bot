import * as chrono from 'chrono-node'

export function parseReminderTime(input: string): number | null {
    const parsed = chrono.parseDate(input, new Date(), { forwardDate: true })
    if (!parsed) return null
    return Math.floor(parsed.getTime() / 1000)
}
