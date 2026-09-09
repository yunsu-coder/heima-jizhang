# 黑马记账

黑马记账是一款运行在 macOS 和 Windows 上的个人本地记账应用。它用于快速记录人民币支出，并按“一级大类 → 二级小类”整理账单。

## 日常使用

```bash
# 安装依赖
npm install

# 在本机打开应用
npm start
```

## 测试

```bash
npm test
```

## 打包

```bash
# macOS 安装包
npm run dist:mac

# Windows 安装包
npm run dist:win
```

## GitHub Actions 自动构建

代码推送到 GitHub 的 `main` 分支后，会自动运行测试并生成 macOS `.dmg` 和 Windows `.exe`。初始仓库名计划为 `yunsu-coder/heima-jizhang`。

详细产品定义和 Codex 协作规则见 [codex.md](./codex.md)。
