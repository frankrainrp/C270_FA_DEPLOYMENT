# Study Butler development

This repository is the Express/EJS/MongoDB Study Butler application referenced by the resume URL `https://github.com/frankrainrp/C270_FA_DEPLOYMENT`. Preserve that URL and the separate `FamilyOS-Showcase` URL.

- Read `README.md`, `.env.example` and `package.json` for configuration and supported commands.
- Scope every task, note, event and chat operation to the authenticated account resolved from the server session.
- Preserve user confirmation before AI-proposed mutations. Keep document parsing bounded and in memory.
- `ChatService.js` maps compatibility IDs to `deepseek-chat` and `deepseek-reasoner`; inspect that map before describing model capabilities.
- Keep OTP/provider credentials server-side. Use deployment-specific environment values and synthetic test accounts.
- Preserve `test/`, lockfiles, Compose, Kubernetes, Ansible and CI configuration.
- Mammoth's CLI parser is pinned through npm overrides to dependency-free `argparse@2.0.1`. Preserve the DOCX and upstream CLI compatibility checks when changing this override.
- Run `npm run test:ci` for application changes. Use container smoke verification for runtime/deployment changes.
- Write English technical documentation using actual model names, endpoints, data stores and operation types.
