# luci-app-mtk-dash2

MTK Dash2 —— MTK EasyMesh（MAP）+MTK Wifi配置管理 LuCI 插件兼luci-app-mtk-easymesh2

本插件在 LuCI 中提供一套面向 MTK EasyMesh 网络的配置、监控与运维界面，支持控制底层MTK Wifi及MTK Easymesh

> 使用反馈：https://www.right.com.cn/forum/thread-8488415-1-1.html

当前版本：`0.3.0`（见 [Makefile](Makefile)）。

---

## 功能列表

后台配置管理基于 `rpcd` 脚本 [map-easymesh](root/usr/libexec/rpcd/map-easymesh) 的字段白名单与分组实现，全部写入操作只针对白名单键。

### 分组字段管理

| 分组 | 主要内容 |
| --- | --- |
| 角色与回程 | 设备角色 `DeviceRole`（Agent / Controller / Controller+Agent）、回程类型 `bh_type`（以太网优先 / 无线回程）、自动回程切换 `AutoBHSwitching` |
| 回程配置 (BhProfile) | `BhProfile0/1/2` 的启用、SSID、认证方式、加密类型、回程密钥（PSK，敏感字段不读回明文）、射频 ID |
| 回程优先级 | `BhPriority2G / 5GL / 5GH / 6G` |
| 漫游与引导 | 频段引导 `SteerEnable`、集中式引导、AP 引导 RSSI 阈值、强制漫游 RSSI 阈值、2G/5G/6G 扫描阈值、低 RSSI 引导边缘（RE / Root）、频段切换时间 |
| 信道规划 | 信道规划开关、R2 开关、2G/5G/5G-高/6G 首选信道、初始化超时、扫描结果有效时间、分离式信道规划、快速信道切换，以及 R2 微调项（CU / EDCCA / OBSS 阈值、空闲字节/时间、度量上报间隔、最小评分余量等可选字段） |
| 网络优化 | 网络优化开关、启动/连接/断开等待时间、优化周期、评分余量、优先 5G 策略（含重试次数）、用户优先级、数据采集时间、CAC 后触发时间、第三方设备连接、外部角色检测、2G/5G-低/5G-高/6G 信道占用过载阈值 |
| 设备信息 | 序列号、软件版本、执行环境、芯片厂商（MediaTek）、STA 事件路径、LAN / WAN 接口等 DE 信息 |
| 其他 MAP 参数 | DHCP 控制、非 MAP AP 兼容、BSS 配置优先级、双回程、最大扫描次数、6G PSC 信道 |
| 1905d 链路配置 | Controller / Agent ALID、各射频频段、桥接接口、AL 接口、以太网设备名、解密失败阈值、GTK 重键间隔、仅 WAN 口以太网上线、MAP 版本（R1/R2） |
| 运行模式 | `mode`（0 / 1 / 2，wapp 运行模式，默认 0） |
| 流量分离 (Traffic Separation) | 客户端 MAC、目的/源 IP、目的/源端口（`srcc_port`）、索引、名称、优先级、协议、SSID（`client_mac` / `dst_ip` / `dst_port` / `src_ip` / `srcc_port` / `index` / `name` / `priority` / `protocol` / `ssid`） |
| Hotspot 2.0 (Passpoint) | `/etc/wapp_ap_ra0.conf` 的 HS2.0/ANQP/BTM/QoS 映射参数约 59 项（`interworking`、`access_network_type`、`hessid`、`domain_name`、`roaming_consortium_oi`、`qosmap`、`timezone` 等，全部为可选写字段） |

### 运维与工具

- **steer_sta 漫游引导**：通过 `wappctrl <iface> mbo steer_sta <MAC>` 主动引导指定 STA 漫游（[steer_sta](root/usr/libexec/rpcd/map-easymesh#L1045-L1052)）。
- **无线回程操作**：`bh_scan`（`iwpriv` 站点扫描）、`bh_connect`（写入 `BhProfile0` 并下发 `iwpriv`，同时将 `bh_type` 置为 wifi）、`bh_disconnect`、`bh_status`。
- **分组重置**：`reset(scope)` 按分组将字段恢复为默认值，支持"全部重置"；重置范围覆盖全部 12 个分组（含运行模式、流量分离 (Traffic Separation)、Hotspot 2.0 (Passpoint)）。
- **WPS / wappctrl 封装**：WPS PBC 触发、回程类型切换、wapp 重载与版本查询，以及 BTM 请求、WNM 请求、QoS 映射、代理 ARP 列表等只读/指令型操作。
- **DPP（WPS 易连）**：二维码、bootstrap、configurator、鉴权、PKEX、chirp、重置等 `dpp_*` 操作集。

### 安全写入与只读查询

- **白名单写入 + 快照 + 失败自动回滚**：`set_field` / `apply_kv` 仅改写白名单内的配置键，且对值做类型/枚举/长度校验；写入前保存 `.mtk-rollback` 快照，原子写入后校验，服务重载（mapd / wapp / bs20）失败时自动回滚（[set_field](root/usr/libexec/rpcd/map-easymesh#L636-L749)、[apply_kv](root/usr/libexec/rpcd/map-easymesh#L821-L866)）。
- **只读拓扑查询**：`topology` 通过 `wappctrl <iface> get map_devices` 与 `get bh_link_list` 只读查询 Mesh 节点与回程链路，不做任何写操作。
- **敏感信息保护**：回读配置时对含 `key` / `pass` / `secret` / `psk` 等关键词的键打码；PSK 字段以"是否已设置"状态呈现，不返回明文。

---

## 依赖

### LuCI 运行时依赖

取自 [Makefile](Makefile) 的 `LUCI_DEPENDS`：

```
+luci-base +luci-lib-jsonc +luci-lib-nixio +libubus-lua +lua +rpcd +iwinfo
```

### 固件侧要求

- 固件需包含 `mtwifi-cfg` + `mtwifi-wapp` 两个包（MediaTek EasyMesh 闭源工具栈），提供：
  - `wappctrl` 可执行文件（`map-easymesh` 只读调用它查询拓扑、执行引导等操作）；
  - `/etc/map/mapd_cfg`、`/etc/map/1905d.cfg` 等 MAP 配置文件；
  - `/etc/wapp_ap_ra0.conf` 等 wapp 守护进程配置。
- 依赖的 MAP 服务：`mapd`、`wapp`、`bs20`（写入后通过 `/etc/init.d/<service> restart` 重载）。

---

## 部署 / 升级 / 卸载

插件支持 OpenWrt 标准 IPK 构建（见下文"构建与发布"），也提供不依赖完整 SDK 的 standalone 部署方式，直接经 SSH/SCP 将文件部署到目标路由器（`make` 变量：`IP` 默认 `192.168.1.1`，`SSH_USER` 默认 `root`）。

### 部署（首次安装）

```bash
make standalone-install IP=192.168.1.1
```

执行内容（对应 [Makefile](Makefile) 的 `standalone-install` 目标）：

- 创建目录：`/usr/libexec/rpcd`、`/usr/share/rpcd/acl.d`、`/usr/share/luci/menu.d`、`/www/luci-static/resources/view/mtk-dash2`、`/usr/share/luci-app-mtk-dash2`；
- 上传文件：
  - `root/usr/libexec/rpcd/mtk-dash2` → `/usr/libexec/rpcd/mtk-dash2`
  - `root/usr/libexec/rpcd/mtk-dash2-advanced` → `/usr/libexec/rpcd/mtk-dash2-advanced`
  - `root/usr/libexec/rpcd/map-easymesh` → `/usr/libexec/rpcd/map-easymesh`
  - `root/usr/share/luci/menu.d/luci-app-mtk-dash2.json` → `/usr/share/luci/menu.d/`
  - `root/usr/share/rpcd/acl.d/*.json` → `/usr/share/rpcd/acl.d/`
  - `htdocs/luci-static/resources/view/mtk-dash2/.` → `/www/luci-static/resources/view/mtk-dash2/`
- 对三个 rpcd 脚本执行 `chmod 0755`，写入版本标记到 `/usr/share/luci-app-mtk-dash2/VERSION`，清理 LuCI 缓存并重载 `rpcd`。

### 升级

```bash
make standalone-upgrade IP=192.168.1.1          # 正常升级
make standalone-upgrade IP=192.168.1.1 FORCE=1  # 强制覆盖（本地版本不高于远程时）
```

升级逻辑（`standalone-upgrade` 目标）：远程未安装则转为安装；远程版本等于本地则跳过；远程版本高于本地则跳过并退出（除非 `FORCE=1`）。

### 卸载

```bash
make standalone-uninstall IP=192.168.1.1
```

删除菜单、三个 rpcd 脚本、ACL 文件、视图目录及 `/usr/share/luci-app-mtk-dash2`，并清理 LuCI 缓存、重载 `rpcd`。

### 其他

```bash
make standalone-version   # 打印当前本地版本（0.3.0）
make standalone-ssh-test  # 测试 SSH 连通性
make standalone-help      # 查看全部 standalone 目标
```

---

## 构建与发布

CI 配置见 [.github/workflows/build-ipk.yml](.github/workflows/build-ipk.yml)。

- **触发方式**：`workflow_dispatch` 手动触发，输入 `version`（`x.y.z` 格式，需匹配 `^[0-9]+\.[0-9]+\.[0-9]+$`）。
- **版本注入**：将 `version` 写入 `root/usr/share/luci-app-mtk-dash2/VERSION`，并同步更新 `Makefile` 的 `PKG_VERSION`、清空 `PKG_RELEASE`。
- **构建环境**：使用 ImmortalWrt SDK `24.10.4`（目标 `mediatek/filogic`，镜像源 vsean），完整更新并安装全部 feeds，将本仓库的 `Makefile`、`htdocs`、`root` 复制进 SDK 后编译：
  ```bash
  make package/luci-app-mtk-dash2/compile V=s
  ```
- **产物**：`luci-app-mtk-dash2_<version>_all.ipk`。
- **上传**：IPK 作为 workflow artifact 上传（`actions/upload-artifact@v4`，失败时若未找到 IPK 将报错）。
- **发布 Release**：构建成功后自动创建 GitHub Release（`softprops/action-gh-release@v2`）：tag 为 `v<版本号>`（如 `v0.3.0`），Release 名称 `luci-app-mtk-dash2 v<版本号>`，IPK 自动附加为发布资产（`fail_on_unmatched_files` 保证找不到 IPK 时发布失败而非发空 Release）。workflow 已设置 `contents: write` 权限。

---

## 目录结构

```
luci-app-mtk-dash2/
├── Makefile                                          # OpenWrt 构建 + standalone 部署目标
├── htdocs/
│   └── luci-static/resources/view/mtk-dash2/         # LuCI 前端视图（.js）
│       ├── about.js         # 关于
│       ├── advanced.js      # 高级参数
│       ├── backup.js        # 备份恢复
│       ├── diagnostics.js   # 诊断工具
│       ├── map-tools.js     # MAP 工具
│       ├── map.js           # MAP EasyMesh（分组字段 / steer_sta / 分组重置）
│       ├── overview.js      # 总览
│       └── wireless.js      # 无线配置
├── root/
│   ├── usr/
│   │   ├── libexec/rpcd/
│   │   │   ├── map-easymesh       # MAP 后端（白名单写入 / 快照回滚 / wappctrl 拓扑）
│   │   │   ├── mtk-dash2          # 基础状态后端
│   │   │   └── mtk-dash2-advanced # 高级参数 / 运行时能力探测后端
│   │   └── share/
│   │       ├── luci/
│   │       │   └── menu.d/luci-app-mtk-dash2.json    # LuCI 菜单
│   │       ├── luci-app-mtk-dash2/VERSION            # 版本标记
│   │       └── rpcd/acl.d/
│   │           ├── luci-app-mtk-dash2.json           # 基础页面 ACL
│   │           └── luci-app-mtk-dash2-map.json       # MAP 页面 ACL
└── .github/workflows/build-ipk.yml                   # CI：构建 IPK 并上传 artifact
```
