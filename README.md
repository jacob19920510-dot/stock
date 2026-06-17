# MarketView

一個本機使用的輕量股票看盤看板。沒有資料庫、沒有登入、沒有 npm 依賴，設定都放在 `config.json`。

資料來源主要使用 Yahoo Finance 公開 chart 端點，適合個人輕量看盤，不適合作為正式交易或專業報價系統。

## 功能

- 台股 / 美股搜尋與加入自選股
- 自選股可拖動排序，排序會寫回 `config.json`
- 台股、美股、指數、期貨分組看盤
- 每 5 秒自動刷新，也可以手動刷新
- 顯示最後刷新時間
- 暗色 / 白色主題切換，瀏覽器會記住選擇
- 點擊股票可打開詳情視窗
- 詳情支援日 K、週 K、月 K、分時
- K 線支援 MA5、MA10、MA20、MA60
- 分時線以平盤為基準，上方紅色、下方綠色
- 圖表標示目前視圖內最高價與最低價
- 圖表 hover 可看當前資料點價格

## 需要的環境

新電腦只需要安裝：

- Git
- Node.js 18 或更新版本
- 一個瀏覽器，例如 Chrome、Edge、Firefox

確認 Node.js 是否已安裝：

```bat
node -v
```

如果能看到版本號，例如 `v20.x.x`，就可以使用。


## Windows 啟動方式

雙擊：

```text
start.bat
```

或在命令列執行：

```bat
start.bat
```

啟動後會自動打開：

```text
http://localhost:8000/
```

## Windows 停止方式

雙擊：

```text
stop.bat
```

或在命令列執行：

```bat
stop.bat
```

## 手動啟動

如果不用 bat，也可以直接執行：

```bat
node server.js
```

然後打開：

```text
http://localhost:8000/
```

如果要改端口：

```bat
set PORT=8080
node server.js
```

然後打開：

```text
http://localhost:8080/
```

## 設定自選股、指數、期貨

主要設定在：

```text
config.json
```

基本格式：

```json
{
  "refreshSeconds": 5,
  "groups": [
    {
      "name": "自選股",
      "symbols": [
        { "symbol": "0050.TW", "name": "元大台灣50", "type": "台股" },
        { "symbol": "QQQ", "name": "Invesco QQQ Trust, Series 1", "type": "美股" }
      ]
    }
  ]
}
```

常見代號格式：

- 台股上市：`2330.TW`
- 台股上櫃：`7723.TWO`
- 美股：`AAPL`、`VOO`、`QQQ`
- 指數：`^TWII`、`^GSPC`、`^NDX`、`^DJI`、`^SOX`
- 期貨：`NQ=F`、`ES=F`、`CL=F`、`GC=F`
- 台灣期貨：`WTX&`（台指期近一）等 Yahoo 台灣期貨代號，代號含 `&` 者會自動改從 Yahoo 台灣頁面取資

也可以直接在頁面搜尋股票後加入自選股。

## 自測

可以用內建 self-test 檢查行情、搜尋和詳情 API 是否正常：

```bat
node server.js --self-test
```

成功時會看到類似：

```text
ok: 15 quotes, detail 245 days
```

## 檔案說明

- `server.js`：本機 HTTP 服務與前端頁面
- `config.json`：本地設定、自選股、指數、期貨清單
- `start.bat`：啟動服務並打開瀏覽器
- `stop.bat`：停止本機服務
- `README.md`：使用說明

## 部署給別人使用

這個專案設計成「clone 後直接跑」：

1. 安裝 Git 和 Node.js 18+
2. `git clone <repo>`
3. `cd stock`
4. Windows 雙擊 `start.bat`
5. 打開 `http://localhost:8000/`

不需要資料庫，不需要帳號，不需要 `.env`，不需要 npm install。

如果要放到公開伺服器，建議先加登入或反向代理保護。這個專案目前刻意沒有做公開部署安全性，預設只給本機或私人環境使用。

## 常見問題

如果 `http://localhost:8000/` 打不開：

- 確認 Node.js 已安裝
- 先執行 `stop.bat`，再執行 `start.bat`
- 確認 8000 端口沒有被其他程式占用

如果某個股票沒有行情：

- 確認 Yahoo Finance 是否支援該代號
- 台股上市通常是 `.TW`
- 台股上櫃通常是 `.TWO`
- 例如築間是 `7723.TWO`

如果搜尋不到台股：

- 可以直接輸入完整代號，例如 `0050`、`00981A`、`7723`
- 如果自動搜尋找不到，也可以手動編輯 `config.json`

## 注意

行情來源是免費公開資料，可能延遲、缺漏或暫時失敗。這個工具只適合個人看盤參考，不應作為正式交易依據。
