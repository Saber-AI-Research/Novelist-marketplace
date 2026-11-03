## Plugin Submission

**Plugin ID:** `<plugin-id>`
**Version:** `<version>`
**Category:** `<category>`

### Checklist

- [ ] `plugins/<id>/manifest.toml` is present and valid
- [ ] `plugins/<id>/README.md` describes the plugin clearly
- [ ] Plugin ID is kebab-case and matches the directory name
- [ ] A GitHub Release exists on my repo with the ZIP asset
- [ ] ZIP contains `manifest.toml` and the declared UI entry, or `index.js` for command plugins
- [ ] ZIP is under 5MB
- [ ] Permissions declared in manifest match actual plugin behavior
- [ ] No `eval()`, `new Function()`, or path traversal patterns in code

### Description

<!-- Brief description of what this plugin does -->

### Permissions Justification

<!-- Explain requested write, fs, net/network, ai:http, or ai:claude-cli permissions. -->

### Screenshots

<!-- Optional: paste screenshots or link to them -->
