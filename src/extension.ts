import * as vscode from 'vscode'

type ScriptType = 'server' | 'client' | 'module'
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const SUFFIXES: Record<ScriptType, string> = {
	server: '.server.luau',
	client: '.client.luau',
	module: ".luau"
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('roblox-script-templates.newScript', async (uri?: vscode.Uri) => {
		const targetDir = await resolveTargetDir(uri)
		if (!targetDir) {
			vscode.window.showErrorMessage('No target folder found.')
			return
		}

		const config = vscode.workspace.getConfiguration('roblox-script-templates')
		const askNameFirst = config.get<string>('firstPrompt') === 'name'

		let type: ScriptType | undefined
		let name: string | undefined

		if (askNameFirst) {
			name = await askScriptName();
			if (!name) return

			type = await pickScriptType();
			if (!type) return
		} else {
			type = await pickScriptType();
			if (!type) return

			name = await askScriptName();
			if (!name) return
		}

		const content = buildContent(type, name)
		const fileUri = vscode.Uri.joinPath(targetDir, name + SUFFIXES[type])

		if (await fileExists(fileUri)) {
			vscode.window.showErrorMessage(`File already exists: ${name}${SUFFIXES[type]}`)
			return
		}

		try {
			await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content))
			await vscode.window.showTextDocument(fileUri)
		} catch (error) {
			vscode.window.showErrorMessage(`Could not create file: ${error}`)
		}
	})

	context.subscriptions.push(disposable)
}

async function resolveTargetDir(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
	if (uri) {
		const stat = await vscode.workspace.fs.stat(uri)
		if (stat.type & vscode.FileType.Directory) return uri

		return vscode.Uri.joinPath(uri, '..')
	}

	return vscode.workspace.workspaceFolders?.[0]?.uri
}

async function pickScriptType(): Promise<ScriptType | undefined> {
	const items: { label: string; type: ScriptType }[] = [
		{ label: 'Server Script', type: 'server' },
		{ label: 'Client Script', type: 'client' },
		{ label: 'Module Script', type: 'module' }
	]

	const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Which kind of script?' })
	return pick?.type
}

async function askScriptName(): Promise<string | undefined> {
	return vscode.window.showInputBox({ prompt: 'Script name', placeHolder: 'MyScript', validateInput: validateScriptName })
}

function validateScriptName(value: string): string | undefined {
	if (value.length === 0) return 'Enter a name'
	if (!IDENTIFIER_PATTERN.test(value)) return 'Use only letters, digits and _, not starting with a digit.'

	return undefined
}

function buildContent(type: ScriptType, name: string): string {
	const config = vscode.workspace.getConfiguration('roblox-script-templates')
	const template = config.get<string>(`templates.${type}`, '')

	return template.replaceAll('{name}', name)
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri)
		return true
	} catch {
		return false
	}
}

export function deactivate() { }