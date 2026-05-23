import { blocks, mrkdwn, section } from 'slack.ts'
import type { AppWithDatabase } from './app.ts'
import type { ReminderEntry } from './db/database.ts'

export interface IReminderManager {
    loadFromDatabase(): Promise<void>
    addReminder(key: string, owner: string, time: number, persist?: boolean): Promise<void>
    deleteReminder(key: string, owner: string, time?: number): Promise<void>
    getPending(): Record<string, ReminderEntry[]>
}

function resolveVariable(name: string, command: {user_id: string, channel_id: string}): string {
    if (name === 'DATE') {
        const timestamp = Math.floor(Date.now() / 1000)
        const fallback = new Date().toISOString()
        const tokenString = '{date_num} {time_secs}'
        return `<!date^${timestamp}^${tokenString}|${fallback}>`
    }
    if (name === 'USER_ID') {
        return command.user_id ?? ''
    }
    if (name === 'USER_PING') {
        return command.user_id ? `<@${command.user_id}>` : ''
    }
    if (name === 'CHANNEL_ID') {
        return command.channel_id ?? ''
    }
    if (name === 'CHANNEL_MENTION') {
        return command.channel_id ? `<#${command.channel_id}>` : ''
    }
    return `{{${name}}}`
}

function resolveVariables(content: string, command: {user_id: string, channel_id: string}): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, name) => resolveVariable(name, command))
}

export function createReminderManager(app: AppWithDatabase): IReminderManager {
    return new ReminderManager(app)
}

class ReminderManager implements IReminderManager {
    private app: AppWithDatabase
    private reminders: Map<string, Array<{ owner: string; time: number; timer?: ReturnType<typeof setTimeout> }>>
    private readonly MAX_DELAY = 2 ** 31 - 1;

    constructor(app: AppWithDatabase) {
        this.app = app
        this.reminders = new Map()
    }

    async loadFromDatabase(): Promise<void> {
        const all = await this.app.database.getAllReminders()
        const now = Date.now()
        for (const [key, arr] of Object.entries(all)) {
            for (const r of arr) {
                // remove expired reminders from DB
                if (r.time * 1000 <= now) {
                    try { await this.app.database.deleteReminder(key, r.owner, r.time) } catch (e) { /* ignore */ }
                    continue
                }
                this.schedule(key, r.owner, r.time)
            }
        }
    }

    private schedule(key: string, owner: string, time: number) {
        if (!this.reminders.has(key)) this.reminders.set(key, [])
        const list = this.reminders.get(key)!
        if (list.some((x) => x.owner === owner && x.time === time)) return

        const item: { owner: string; time: number; timer?: ReturnType<typeof setTimeout> } = { owner, time }
        list.push(item)

        const delay = time * 1000 - Date.now()
        if (delay <= 0) {
            setImmediate(() => void this.trigger(key, owner, time))
            return
        }

        item.timer = this.setLongTimeout(() => void this.trigger(key, owner, time), delay)
    }

    private setLongTimeout(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
        if (delay <= this.MAX_DELAY) return setTimeout(fn, delay)
        return setTimeout(() => {
            const remaining = delay - this.MAX_DELAY
            this.setLongTimeout(fn, remaining)
        }, this.MAX_DELAY)
    }

    private async trigger(key: string, owner: string, time: number) {
        try {
            const tag = await this.app.database.get(key)
            const text = tag ? `⏰ Reminder for tag *${key}*: ${resolveVariables(tag.value, { user_id: owner, channel_id: (await this.app.user(owner).im()).id })}` : `⏰ Reminder for tag *${key}*`
            await this.app.user(owner).send({ blocks: blocks(section(mrkdwn(text))) })
        } catch (e) {
            console.error('Failed to send reminder DM', e)
        } finally {
            this.removeFromMemory(key, owner, time)
            try { await this.app.database.deleteReminder(key, owner, time) } catch (e) { /* ignore */ }
        }
    }

    private removeFromMemory(key: string, owner: string, time: number) {
        const arr = this.reminders.get(key)
        if (!arr) return
        const idx = arr.findIndex((r) => r.owner === owner && r.time === time)
        if (idx !== -1) {
            const [it] = arr.splice(idx, 1)
            if (it) {
                if (it.timer) clearTimeout(it.timer)
            }
        }
        if (arr.length === 0) this.reminders.delete(key)
    }

    async addReminder(key: string, owner: string, time: number, persist = false): Promise<void> {
        if (persist) await this.app.database.setReminder(key, owner, time)
        this.schedule(key, owner, time)
    }

    async deleteReminder(key: string, owner: string, time?: number): Promise<void> {
        await this.app.database.deleteReminder(key, owner, time)
        if (!this.reminders.has(key)) return
        if (time === undefined) {
            const arr = this.reminders.get(key)!
            for (let i = arr.length - 1; i >= 0; i--) {
                let item = arr[i];
                if (item) {
                    if (item.owner === owner) {
                        if (item.timer) clearTimeout(item.timer)
                        arr.splice(i, 1)
                    }
                }
            }
            if (arr.length === 0) this.reminders.delete(key)
            return
        }
        this.removeFromMemory(key, owner, time)
    }

    getPending(): Record<string, ReminderEntry[]> {
        const out: Record<string, ReminderEntry[]> = {}
        for (const [k, arr] of this.reminders.entries()) {
            out[k] = arr.map((a) => ({ owner: a.owner, time: a.time }))
        }
        return out
    }
}
