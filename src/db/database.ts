import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'

export interface TagEntry {
	value: string
	owner: string
	count: number
}

export interface ReminderEntry {
	owner: string
	time: number
}

export interface KeyValueDatabase {
    has_initialize() : Promise<boolean>
	initialize(): Promise<void>
	/** Tag */
	get(key: string): Promise<TagEntry | null>
	set(key: string, value: string, owner: string): Promise<void>
	delete(key: string): Promise<void>
	listByOwner(userId: string): Promise<string[]>
	incrementCount(key: string): Promise<void>
	getAll(): Promise<Record<string, TagEntry>>
	/** Reminder */
	setReminder(key: string, owner: string, time: number): Promise<void>
	getReminder(key: string): Promise<ReminderEntry[]>
	deleteReminder(key: string, owner: string, time?: number): Promise<void>
	listRemindersByOwner(userId: string): Promise<Array<{ key: string; owner: string; time: number }>>
	getAllReminders(): Promise<Record<string, ReminderEntry[]>>
}

export interface JsonDatabaseConfig {
	filePath: string
}

export class JsonKeyValueDatabase implements KeyValueDatabase {
	private config: JsonDatabaseConfig
	private data: Record<string, TagEntry>
	private reminders: Record<string, ReminderEntry[]>
	private initialized: boolean

	constructor(config: JsonDatabaseConfig) {
		this.config = config
		this.data = {}
		this.reminders = {}
		this.initialized = false
	}
    async get(key: string): Promise<TagEntry | null> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		return this.data[key] ?? null
	}

	async set(key: string, value: string, owner: string): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		const existing = this.data[key]
		const count = existing?.count ?? 0
		this.data[key] = { value, owner, count }
		await this.persist()
	}

	async delete(key: string): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		delete this.data[key]
		await this.persist()
	}

	async getAll(): Promise<Record<string, TagEntry>> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		return this.data
	}

	/** Reminder helpers */
	async setReminder(key: string, owner: string, time: number): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		if (!this.reminders[key]) {
			this.reminders[key] = []
		}
		this.reminders[key].push({ owner, time })
		await this.persist()
	}

	async getReminder(key: string): Promise<ReminderEntry[]> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		return this.reminders[key] ?? []
	}

	async deleteReminder(key: string, owner: string, time?: number): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		const existing = this.reminders[key]
		if (!existing) return
		this.reminders[key] = existing.filter(r => {
			if (r.owner !== owner) return true
			if (time !== undefined && r.time !== time) return true
			return false 
		})
		if (this.reminders[key].length === 0) {
			delete this.reminders[key]
		}
		await this.persist()
	}

	async listRemindersByOwner(userId: string): Promise<Array<{ key: string; owner: string; time: number }>> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		const result: Array<{ key: string; owner: string; time: number }> = []
		for (const [k, arr] of Object.entries(this.reminders)) {
			for (const r of arr) {
				if (r.owner === userId) {
					result.push({ key: k, owner: r.owner, time: r.time })
				}
			}
		}
		return result
	}

	async getAllReminders(): Promise<Record<string, ReminderEntry[]>> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		return this.reminders
	}

	async incrementCount(key: string): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		const entry = this.data[key]
		if (!entry) {
			return 
		}
		entry.count = (entry.count ?? 0) + 1
		await this.persist()
	}

	async listByOwner(userId: string): Promise<string[]> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		const keys: string[] = []
		for (const [key, entry] of Object.entries(this.data)) {
			if (entry.owner === userId) {
				keys.push(key)
			}
		}
		return keys
	}

	async initialize(): Promise<void> {
		const filePath = resolve(this.config.filePath)
		const dirPath = dirname(filePath)

		try {
			const content = await readFile(filePath, 'utf-8')
			const parsed = JSON.parse(content)
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('tags' in parsed || 'reminders' in parsed)) {
				this.data = parsed.tags ?? {}
				this.reminders = parsed.reminders ?? {}
			} else {
				this.data = parsed as Record<string, TagEntry>
				this.reminders = {}
			}
		} catch {
			await mkdir(dirPath, { recursive: true })
			this.data = {}
			this.reminders = {}
			await this.persist()
		}

		this.initialized = true
	}

	private async persist(): Promise<void> {
		const filePath = resolve(this.config.filePath)
		const payload = {
			tags: this.data,
			reminders: this.reminders,
		}
		await writeFile(filePath, JSON.stringify(payload, null, 2))
	}

	async has_initialize(): Promise<boolean> {
		try {
			const filePath = resolve(this.config.filePath)
			await readFile(filePath, 'utf-8')
			return true
		} catch {
			return false
		}
	}
}
