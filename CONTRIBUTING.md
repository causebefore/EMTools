# Contributing to EMTools

感谢你关注 EMTools。提交 Issue 或 Pull Request 前，请先阅读以下规则。

所有参与者都应遵守 [行为准则](./.github/CODE_OF_CONDUCT.md)。

## 提交 Issue

反馈 Bug 时，请尽量提供：

- 操作系统
- uTools 版本
- EMTools 版本
- 使用的具体工具模块
- 复现步骤
- 期望结果
- 实际结果
- 错误截图或示例文件

如果涉及工程文件、MAP 文件、HEX 文件，请先脱敏后再上传。

新增功能或较大改动，建议先提交 Issue 说明目标、场景和预期收益，再开始编码。

## 提交 Pull Request

请按以下流程提交代码：

1. Fork 本仓库
2. 默认从 `dev` 创建新分支；`master` 用于稳定发布或版本归档
3. 修改代码
4. 本地执行测试和构建
5. 提交 Pull Request

建议在 PR 中明确填写以下内容：

- 问题背景或关联 Issue
- 解决方式
- 影响范围
- 本地验证结果
- 是否包含 UI 变更截图或录屏

本地测试命令：

```bash
npm ci
npm --prefix public/preload ci
npm test
npm run build
```

## 分支命名建议

```text
feature/xxx   新功能
fix/xxx       Bug 修复
docs/xxx      文档修改
refactor/xxx  代码重构
debug/xxx     临时调试，用完删除
```

## 代码要求

- 不要混入无关格式化修改
- 不要提交无关文件
- 不要提交本地配置文件、日志文件或临时文件
- 工具逻辑优先放在 `src/utils`
- 页面逻辑放在对应的 `src/views/*`
- uTools preload 相关能力放在 `public/preload`
- 修改功能时，应尽量补充或更新测试
- 提交前请确保 CI 对应的测试和构建命令可以在本地通过

## Commit Message 建议

建议使用以下格式：

```text
feat: add new feature
fix: fix bug
docs: update documentation
refactor: refactor code
test: add or update tests
chore: update config or build files
```

示例：

```text
fix: correct crc16 calculation
docs: update installation guide
feat: add hex diff tool
```

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
