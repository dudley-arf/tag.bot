import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'

export interface TagEntry {
	value: string
	owner: string
	count: number
}

export interface KeyValueDatabase {
    has_initialize() : Promise<boolean>
	initialize(): Promise<void>
	get(key: string): Promise<TagEntry | null>
	set(key: string, value: string, owner: string): Promise<void>
	delete(key: string): Promise<void>
	listByOwner(userId: string): Promise<string[]>
	incrementCount(key: string): Promise<void>
}

export interface JsonDatabaseConfig {
	filePath: string
}

export class JsonKeyValueDatabase implements KeyValueDatabase {
	private config: JsonDatabaseConfig
	private data: Record<string, TagEntry>
	private initialized: boolean

	constructor(config: JsonDatabaseConfig) {
		this.config = config
		this.data = {}
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
		const filePath = resolve(this.config.filePath)
		await writeFile(filePath, JSON.stringify(this.data, null, 2))
	}

	async delete(key: string): Promise<void> {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call initialize() first.')
		}
		delete this.data[key]
		const filePath = resolve(this.config.filePath)
		await writeFile(filePath, JSON.stringify(this.data, null, 2))
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
		const filePath = resolve(this.config.filePath)
		await writeFile(filePath, JSON.stringify(this.data, null, 2))
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
			this.data = JSON.parse(content)
		} catch {
			await mkdir(dirPath, { recursive: true })
			this.data = {}
			await writeFile(filePath, JSON.stringify(this.data, null, 2))
		}

		this.initialized = true
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
