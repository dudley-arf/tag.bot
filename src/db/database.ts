import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'

export interface KeyValueDatabase {
    has_initialize() : Promise<boolean>
	initialize(): Promise<void>
	get(key: string): Promise<string | null>
	set(key: string, value: string): Promise<void>
}

export interface JsonDatabaseConfig {
	filePath: string
}

export class JsonKeyValueDatabase implements KeyValueDatabase {
	private config: JsonDatabaseConfig
	private data: Record<string, string>

	constructor(config: JsonDatabaseConfig) {
		this.config = config
		this.data = {}
	}
    async get(key: string): Promise<string | null> {
		throw new Error('Not implemented')
	}

	async set(key: string, value: string): Promise<void> {
		throw new Error('Not implemented')
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
