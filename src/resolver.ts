export function resolveVariable(name: string, command: { user_id?: string; channel_id?: string }): string {
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

export function resolveVariables(content: string, command: { user_id?: string; channel_id?: string }): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, name) => resolveVariable(name, command))
}
