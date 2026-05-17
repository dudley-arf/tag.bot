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
		throw new Error('Not implemented')
	}

    async has_initialize() : Promise<boolean> {
        throw new Error("Not implemented");
    }
}
