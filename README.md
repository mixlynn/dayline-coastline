<div align="center">

# Dayline · 海岸线

**让海岸线，跟着日落走。**
*Let the coastline follow the sun.*

一个以日落为锚点、由天文时间驱动的 8 帧动态壁纸播放器。  
8 frames of Big Sur coastline, following the sun.

`v3.2.5` · `Vanilla JS` · `No build` · `Zero runtime dependencies`

<img src="docs/hero.jpg" alt="Dayline 海岸线动态壁纸预览" width="860" />

</div>

---

## 这是什么

Dayline 把 macOS Big Sur 的 8 张海岸线序列图按太阳轨迹播放。它不是简单按固定时间轮播图片，而是：

- 根据经纬度和日期**实时计算当地日落时间**
- 以日落为锚点，生成 8 个时段的**真实边界**
- 在每个时段开始前的一段窗口内，用 smoothstep 做柔和交叉淡化
- 再叠加一层随时间变化的色温、亮度、饱和度和暗角，让画面更接近“一整天”的观感

项目是纯前端静态页面：没有构建、没有框架、没有 npm 依赖，双击或丢进任意静态服务器即可运行。

## 功能

- **日落锚点时间线**：8 个时段随日落整体平移，而不是写死钟点
- **8 帧交叉淡化**：窗口宽度会按相邻时段间隔自动收窄，永远不会同时混两个过渡
- **四种模式**：跟随系统 / 时间定格 / 演示 / 自定义
- **定位优先级**：手动保存 > `setting.json` > IP 粗定位 > 内置默认坐标（岑溪）
- **定位容错**：浏览器定位失败自动尝试 IP；IP 失败回退默认；4 秒超时，不阻塞首屏
- **电影感调色**：亮度 / 色温 / 饱和度关键帧 + 暗角，随时间平滑变化
- **预加载可控**：全量加载 8 张原图，或只预加载当前/下一张
- **JSONC 配置**：`setting.json` 支持 `//`、`/* */` 和行尾注释
- **低存在感 UI**：右下角 Apple 风格毛玻璃设置面板，底部按任务栏/安全区避让
- **回归测试**：核心时间线、窗口、配置合并、JSONC 解析都有 Node 断言

## 快速开始

### 方式一：本地服务器（推荐）

```bash
git clone https://github.com/mixlynn/dayline-coastline.git
cd dayline-coastline
python -m http.server 8080
```

然后打开 <http://localhost:8080>。

> 用 HTTP/HTTPS 打开时，页面才能正常 `fetch` `setting.json` 和进行浏览器定位。

### 方式二：直接打开

双击 `index.html` 也能播放。但 `file://` 下浏览器通常会阻止 `fetch`，此时会自动回退到 `script.js` 内置默认配置。

### 方式三：Lively Wallpaper

在 Lively Wallpaper 中添加 `index.html`（或本地 HTTP 地址）作为网页壁纸即可。设置面板会自动避让 Windows 底栏。

## 模式说明

| 模式 | 行为 |
| --- | --- |
| 跟随系统 | 使用本机当前时间，随真实时间推进 |
| 时间定格 | 冻结当前显示时间，画面不再变化 |
| 演示模式 | 非过渡区停留 `demo.holdSeconds`（默认 1s），过渡区按 `demo.transitionSpeedMultiplier`（默认 300x）穿过窗口 |
| 自定义模式 | 用时间滑条定位到任意分钟，用倍率滑条加速（1x–800x） |

时间滑条和倍率滑条只在“自定义模式”下可拖动。面板会显示当前时段、真实区间、日落时间、当前/下一次过渡和混合进度。

## 时间线模型

8 张图对应 8 个时段，编号与 `BgimgBigsur/readme.md` 一致：

| 段 | 图片 | 默认时段（日落=18:00） | 相对日落偏移 |
| --- | --- | --- | --- |
| 1 | Appearance Dynamic1 | 20:30–05:00 | +150 min |
| 2 | Appearance Dynamic2 | 05:00–06:00 | −780 min |
| 3 | Appearance Dynamic3 | 06:00–09:00 | −720 min |
| 4 | Appearance Dynamic4 | 09:00–11:30 | −540 min |
| 5 | Appearance Dynamic5 | 11:30–14:30 | −390 min |
| 6 | Appearance Dynamic6 | 14:30–17:30 | −210 min |
| 7 | Appearance Dynamic7 | 17:30–18:30 | −30 min |
| 8 | Appearance Dynamic8 | 18:30–20:30 | +30 min |

> 表中的“默认时段”只在日落恰好为 18:00 时成立。实际运行时所有边界都会随当地日落平移，设置面板显示的也是平移后的真实区间。

核心计算：

```text
boundary[seg] = (sunsetMinute + offsetFromSunsetMin[seg]) mod 1440
windowWidth[seg] = min(transitionWindowMinutes, boundary[seg] - boundary[prevSeg])
window[seg] = [boundary[seg] - windowWidth[seg], boundary[seg])
```

- 过渡窗口在时段开始前展开，结束时正好到达新时段边界
- 窗口宽度会被相邻时段间隔截断，避免多个窗口重叠
- 混合使用 `smoothstep`，alpha 到达 1 时新图已经完整显示

## 配置

`setting.json` 是可选的，只读，不会在运行时写回。支持 JSONC 注释。

```jsonc
{
  "version": "1.1",

  // 可选：不写则走手动坐标 -> IP -> 默认坐标
  // "location": { "lat": 22.9, "lon": 110.9667, "city": "岑溪市" },

  "timeline": {
    "transitionWindowMinutes": 30,
    "segments": {
      "1": { "name": "夜晚/深夜", "startHour": 20.5, "durationHours": 8.5 },
      "7": { "name": "傍晚", "startHour": 17.5, "durationHours": 1 }
    }
  },

  "demo": {
    "holdSeconds": 1,
    "transitionSpeedMultiplier": 300
  },

  "performance": {
    "preloadAllImages": false
  }
}
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `location.lat` / `location.lon` | `null` | 可选固定坐标；超出纬度 ±90、经度 ±180 会被忽略 |
| `timeline.transitionWindowMinutes` | `30` | 过渡窗口最大分钟数，实际会按相邻间隔收窄 |
| `timeline.segments.N.startHour` | 内置 | 该时段的实际边界，`17.5` 表示 17:30 |
| `timeline.segments.N.durationHours` | 内置 | 兼容字段，仅用于一致性提示；实际结束时间取下一段 `startHour` |
| `demo.holdSeconds` | `1` | 演示模式非过渡区停留秒数 |
| `demo.transitionSpeedMultiplier` | `300` | 演示模式过渡区加速倍率 |
| `performance.preloadAllImages` | `false`（仓库默认） | `true` 一次性保留 8 张原图（约 1.16 GB 解码内存）；`false` 按需，最多 3 张 |

配置非法或解析失败时，程序不会中断：控制台会输出警告，并回退到内置默认配置。

## 定位优先级

1. **localStorage 手动保存**（设置面板“保存经纬度”）
2. **`setting.json` 的 `location`**（默认注释掉）
3. **IP 粗定位**（`ipwho.is`，4 秒超时）
4. **内置默认坐标**：岑溪市 `22.9, 110.9667`

说明：

- 浏览器定位权限只在点击“更新位置信息”时请求
- 手动保存的坐标刷新后仍然生效，并且优先级最高
- 点击“清空并粗定位”会删除手动缓存、触发 IP 定位；IP 失败时回退配置坐标，再失败回退默认坐标
- IP 定位结果不会写回手动缓存，避免把一次粗略定位永久当成手动坐标
- 定位状态文案统一由界面加“定位：”前缀

## 内存控制

原图尺寸为 6016×6016，单张解码后约 145 MB。项目**不降低分辨率**，而是通过预加载策略控制内存：

- 按需模式只保留当前、下一张和正在混合的叠加层，最多 3 张解码图（约 435 MB 上限）
- 过渡淡出 400ms 后释放 `imgB` 的位图
- 全量加载会保留 8 张解码图（约 1.16 GB），仅在需要极致顺滑时开启
- 面板中的“图片预加载”开关可随时切换，选择会写入 `localStorage`

> 不降分辨率是刻意的画质优先策略。如果更在意内存而不是画质，可以自行生成显示尺寸的图片变体替换 `BgimgBigsur/`。

## 项目结构

```text
.
├── index.html              # 页面结构与设置面板
├── style.css               # 毛玻璃 UI、底部避让、信息面板
├── script.js               # 时间线、渲染、模式、定位、配置
├── setting.json            # 可选 JSONC 配置
├── timeline-model.test.js  # Node 回归测试
├── BgimgBigsur/            # 8 张 Big Sur 海岸线原图
├── docs/hero.jpg           # README 预览图
└── README.md
```

## 测试

```bash
node --check script.js
node --check timeline-model.test.js
node timeline-model.test.js
```

测试覆盖：

- 日落锚点边界与 8 段顺序
- 过渡窗口起点/终点
- 混合状态与面板状态
- JSONC 行尾/块注释、字符串中的 `//`
- `demo.transitionSpeedMultiplier` 合并
- 坐标 `null` / 越界校验
- 大窗口自动收窄、避免重叠
- `durationHours` 不参与实际边界
- 面板区间随日落平移

## 浏览器兼容与限制

- 目标为现代 Chromium / Safari
- 浏览器定位通常要求 HTTPS 或 `localhost`；嵌入式 WebView 可能报告 `isSecureContext=false`，项目不预先拦截，交给平台处理
- IP 粗定位依赖第三方服务，离线或被拦截时会回退默认坐标
- 8 张原图合计约 85 MB；开启“全量加载”会占用较多内存，低配设备建议关闭
- `setting.json` 只读；需要持久修改请手动编辑文件
- 演示模式会跳过非过渡时段，只循环展示 8 个过渡窗口

## 素材与许可

- `BgimgBigsur/` 中的 Big Sur 壁纸素材版权归 Apple Inc. 所有，本项目仅用于个人学习与演示，请勿商用。
- 代码部分暂未附开源许可证（LICENSE）；如需复用、分发或商用，请先与作者确认并补充相应许可证。

## 版本记录

- **v3.2.5**：手动坐标优先、定位校验与 4 秒超时、移除日落提醒死代码、窗口防重叠、面板显示真实区间、JSONC 解析增强、演示参数生效、按需预加载接线、倍率滑块同步、移动端底部避让修复
- **v3.2.4**：日落锚点动态时间线、定位与 8 段窗口展示
- **v3.2.0**：演示模式相位机、自定义模式、时间滑条窗口标记

---

<div align="center">

**Dayline · 海岸线**  
让海岸线，跟着日落走。

</div>
