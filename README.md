# Codex 余额菜单补丁(codex-provider-balance)

在 Codex 桌面版右上角头像菜单里,把各家的 API 余额直接显示在「剩余用量」下面:一个平台一行,每行带对应厂商的 logo,点击任意一行可以打开本机配置面板。

## 这个仓库里有什么

仓库由四块组成,彼此可以独立使用:

1. 本机余额服务 + 配置面板 — `scripts/deepseek-balance-agent.mjs`

   一个只监听 `127.0.0.1:17561` 的小型 HTTP 服务。它读取你本机保存的 API key,去各平台官方接口查询余额,同时提供一个网页面板,用来添加厂商、填写 key、开关「是否在 Codex 菜单里显示」。

2. Codex 桌面版 asar 补丁 — `scripts/patch-asar.mjs` 及配套脚本

   正版 Codex 装在 WindowsApps 下,只读且有签名校验,不能直接改。补丁会先把 Codex 复制到你自己可写的目录,再修改其中的 `app.asar`,注入一段 React 代码,把余额行插到头像菜单里「显示宠物」的上面。

3. Codex MCP 插件 — `plugins/deepseek-balance/`

   标准的 Codex MCP 插件,可以在对话里让 Codex 查询 DeepSeek 余额。它和上面的菜单补丁是两套独立方案,可以只装其中一个。

4. 独立 Electron 配置面板 — `desktop/`(可选)

  一个粉色主题的桌面 App,用来管理厂商和 key。它会自动拉起本机余额服务,所以不用手动启动。

## 分身 + 补丁:和正版 Codex 并存

这套方案不会去改你已装的正版 Codex,而是把正版**复制一份**出来,只改这份拷贝。这份拷贝就是所谓的「分身」:

- 正版 Codex(WindowsApps 下的 MSIX 包)原封不动,随时可以正常打开;
- 分身装在 `C:\CodexDeepSeekPatched`,是独立目录、独立可执行文件,只有它带补丁;
- 分身有自己的 Electron 数据目录 `C:\CodexPatchedUserData`,窗口状态、本地存储跟正版互不干扰;
- 想彻底恢复,直接删掉分身那个目录就行,正版一点没动。

**分身和正版可以同时运行**,两个窗口一起开着没有任何冲突:

- 它们登录的是同一个账号、读同一份 `%USERPROFILE%\.codex`,所以任务列表、配置、skills、plugins、额度都是同一份,不是两个互相独立的账号;
- 余额行只出现在**分身**的头像菜单里(补丁只打在分身上),正版保持原样;
- 唯一要注意的是:两边共享同一个 `.codex`,**别在同一时间对同一个任务做编辑**,免得互相抢锁;不同任务并行没问题。

推荐的用法就是:平时用正版,想随时在「剩余用量」下面直接看到各家余额时,打开分身;两边一起开也完全可以。

## 环境要求

- Windows 10 / 11
- Node.js 18 或更高版本(Node 自带 `fetch`,脚本依赖它)
- 正版 Codex 桌面版(MSIX 包名 `OpenAI.Codex`),至少启动过一次
- 各平台自己的 API key(本仓库不提供、不内置任何 key)

## 快速开始(菜单补丁方案)

1. 安装并至少启动过一次正版 Codex 桌面版。
2. 把本仓库克隆或下载到本地。
3. 在 PowerShell 里运行安装脚本:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-user-patched-codex.ps1
```

   脚本会依次完成:

   - 把 Codex 复制到 `C:\CodexDeepSeekPatched`;
   - 调用 `patch-asar.mjs` 修补 `app.asar`;
   - 在桌面创建快捷方式 `Codex Provider Balance Patched`;
   - 在「启动」文件夹创建两个快捷方式:余额服务自启、Codex 更新后自动重打补丁;
   - 如果余额服务没在运行,顺手启动它。

   如果这一步出现权限相关报错,改用管理员身份的 PowerShell 再跑一次。

4. 打开配置面板 `http://127.0.0.1:17561/`,填写厂商名字、选择类型、粘贴 API key,勾选「显示」。

5. 用桌面上的 `Codex Provider Balance Patched` 快捷方式打开补丁版 Codex,点头像菜单,「剩余用量」下面就会出现余额行。

路径都可以覆盖,脚本带了参数:

```powershell
.\scripts\install-user-patched-codex.ps1 -Target 'D:\CodexPatched' -UserData 'D:\CodexPatchedData'
```

也支持环境变量 `CODEX_PATCH_TARGET` / `CODEX_PATCH_USERDATA`。

## 只装 MCP 插件(不改 Codex 文件)

如果你不想动 Codex 的安装文件,可以只用标准插件:

```powershell
setx DEEPSEEK_API_KEY "sk-你的-deepseek-key"
```

设置后重启 Codex,然后:

```powershell
codex plugin marketplace add .\.agents\plugins
codex plugin add deepseek-balance@deepseek-balance-local
```

新建一个任务,让 Codex「显示我的 DeepSeek 余额」即可。注意:当前 Codex 没有开放头像菜单的插件插槽,插件只能在对话里出卡片,不能出现在「剩余用量」那一栏;要出现在那一栏就得用上面的 asar 补丁。

## 支持的平台

| 类型 | 名称 | 余额接口 | 状态 |
| --- | --- | --- | --- |
| `deepseek` | DeepSeek | `GET https://api.deepseek.com/user/balance` | 已实现 |
| `moonshot` | Kimi(Moonshot) | `GET https://api.moonshot.cn/v1/users/me/balance` | 已实现 |
| `doubao` | 豆包 / 火山方舟 | 需火山引擎 AK/SK 签名调用计费 OpenAPI | 仅凭 API key 无法查询 |
| `openai` / `anthropic` / `siliconflow` / `custom` | 同名 | - | 目前只占位显示「已配置」,需要自己补 adapter |

想加平台:在 `deepseek-balance-agent.mjs` 顶部的 `providerTypes` 里加一项,再写一个对应的 `fetchXxxBalance` 适配函数即可;菜单里的 logo 取自 `scripts/logos.json`。

## 补丁原理(踩过的三个坑)

`app.asar` 是一个自定义格式:16 字节头 + JSON 目录树 + 文件数据。改写时有几个容易翻车的点:

1. 数据起点是 `16 + 对齐后的 JSON 长度`,不是 `16 + JSON 长度`。JSON 长度按 4 字节向上对齐,直接用 `jsonLen` 会整体错位。
2. 原包里有一批条目带 `unpacked: true`,数据其实在 `app.asar.unpacked/`,这些条目必须原样保留,不能把数据塞回 asar。
3. 替换区间要从函数开头切到 `}var uGt,` 之前那个 `}`,而注入代码自带闭合花括号,所以要用 `slice(0,start) + injection + slice(end+1)`,否则会多出一个 `}` 导致语法错误。
4. 窗口标题来自 `.vite/build/bootstrap-*.js` 里的 `app.setName(...)`,不是 `package.json`。

## 安全与隐私

- 你的 API key 只存在本机 `%USERPROFILE%\.codex-provider-balances\providers.json`。
- 余额服务只绑定 `127.0.0.1`,不监听外部网卡。
- key 只会作为 Bearer token 发给你配置的那家平台官方接口。
- 本仓库不包含任何真实 key,`.gitignore` 已经排除 `providers.json`。请务必不要把自己的 `providers.json` 提交上来。

## 别人下载了能直接用吗

不能开箱即用,需要几步自己的准备工作:

1. 得自己安装正版 Codex 桌面版(MSIX)。仓库里没有、也不能带 Codex 本体。
2. 得自备各平台 API key,并自己填到配置面板里。
3. 默认路径写的是 `C:\CodexDeepSeekPatched`,想换位置用参数或环境变量覆盖。
4. Codex 每次更新都会替换 `app.asar`,补丁会消失,需要重打。脚本已经注册了登录自启 + 定时重打,基本不用手动管。
5. 补丁锚定的是打包后的压缩函数名(如 `lGt`、`uGt`),Codex 大版本重构后锚点可能失效,那时需要重新定位注入点。所以这套东西更偏「自己维护的本地魔改」,不是一劳永逸的成品。
6. 目前只在 Windows 上验证过,其他系统没测。

## 想卸载 / 恢复

- 删掉 `C:\CodexDeepSeekPatched` 整个目录即可,正版 Codex 完全不受影响。
- 删掉「启动」文件夹里的 `Codex Provider Balance Agent` 和自动重打补丁两个快捷方式。
- 结束 `node` 进程即可停掉 17561 端口的服务。

## 目录结构

```
codex-provider-balance/
  README.md
  README.en.md
  LICENSE
  .gitignore
  .agents/plugins/marketplace.json     # 本地插件市场清单
  plugins/deepseek-balance/            # MCP 插件
  scripts/                             # 余额服务 + asar 补丁工具链
    deepseek-balance-agent.mjs         # 余额服务与配置面板
    patch-asar.mjs                     # 补丁主程序
    gen-inject.mjs                     # 生成注入代码
    inject-lgt.js                      # 生成出来的注入片段
    logos.json                         # 各厂商 logo 的 SVG path
    verify-inject.mjs                  # 校验补丁是否写入
    install-user-patched-codex.ps1     # 一键安装
    ensure-balance-agent.ps1           # 看门狗:保证服务在跑
    restart-agent.ps1                  # 重启余额服务
    launch-patched.mjs                 # 启动补丁版 Codex
    do-patch.ps1                       # 开发者:对现成目录重打补丁
    providers.example.json             # 配置样例
  desktop/                             # 独立 Electron 配置面板(可选)
```

## License

MIT,见 `LICENSE`。
