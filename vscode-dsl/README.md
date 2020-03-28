# vscode-dsl

## Develop

- Run `npm install`
- Open VS Code
- Press Ctrl(Cmd)+Shift+B to compile the client and server.
- Switch to the Debug viewlet. (Ctrl(Cmd)+Shift+D)
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'dsl' language mode.

Ref: https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

## Build

```
npm run package
```

## Install

```
npm run use
```
