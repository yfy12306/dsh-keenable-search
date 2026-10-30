# dsh-keenable-search

DSH 插件：把 [Keenable](https://keenable.ai) 的免费公共搜索 API 注册为 DSH 的
web-search provider——无需 API key。

- 30 秒内存缓存，避免短窗口内重复查询打 API
- 注册到 `ctx.web` 的 search provider（id: `keenable`）

## 安装（单文件插件）

把 `keenable-search.js` 放到 profile 目录（如 `~/.dsh/profiles/desktop/`），在
`cordis.patch.yml` 追加：

```yaml
- insert:
    - id: web-search-keenable
      name: ./keenable-search.js
```

要把默认搜索源切到 Keenable，另加：

```yaml
settings:
  searchProvider: keenable
```

重启 DSH 生效。

## License

MIT
