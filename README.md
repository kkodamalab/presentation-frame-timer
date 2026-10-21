# Presentation Frame Timer

発表時間を、画面外周を時計回りに進む一本の線で表示するWebアプリ。

- 公開: https://kkodamalab.github.io/presentation-frame-timer/
- リポジトリ: https://github.com/kkodamalab/presentation-frame-timer

## 使い方

時間を選びSTART。PAUSE / RESUMEで中断・再開、RESETで先頭へ戻ります。
1秒〜120分、5つのプリセット、グラデーションと任意の単色、3〜20pxの太さ、残り時間の位置・文字サイズ・不透明度、終了時の点滅・音を設定できます。
デモスライダーは操作時に停止し、本番時には非表示にできます。設定をlocalStorageに保存します。実行状態は再読み込みでリセットします。

FULLSCREENはブラウザのFullscreen APIです。ZoomやPowerPointを透過表示する機能ではありません。Zoomの共有対象が切り替わっても、このページを開いたままであればタイマーは継続します。画面共有にフレームを含めたい場合はOBS等の合成が必要です。

## 描画と計測

Canvasの**単一パスを一回だけstroke**して色面のalpha maskにします。dashは一切使いません。左上→右上→右下→左下→左上の順に、実際の中心線の周長 `P = 2 × (width + height)` と進行率の積だけパスを延ばします。線が画面外に切れないよう中心線を半径+1px内側に配置します。

グラデーションは周長上の固定距離に対応する青→水色→緑→黄→赤。辺ごとの色面を角の対角線で接続し、単一パスで切り出します。線分の繰り返しではありません。開始色・終了色は変更可能です。100%の左上には開始色と終了色の境界があります。

Date.now()との差分で経過時間を算出し、requestAnimationFrameは再描画のみに使用。バックグラウンドから戻ると実時刻に追従します。OS時計の手動変更の影響は受けます。ブラウザがバックグラウンド処理を停止すると通知音は復帰時まで遅れる場合があります。音声はユーザーがSTARTを押したときに有効化し、OBSの自動開始では保証しません。

## Windowsでのオーバーレイ

| 方法 | 適する用途 | 制約 |
| --- | --- | --- |
| Electronの透明・最前面・クリック透過ウィンドウ | 発表者自身のZoom/PowerPoint画面に枠を重ねる | Electron版を同梱。実機での重なり・共有映像への含有はアプリやOSの表示方式に依存 |
| OBS Browser Source | 配信・録画・共有映像への合成 | Zoomの通常ウィンドウに直接重なるわけではない。OBSの合成結果を共有する |
| Document Picture-in-Picture | 小さな最前面タイマー | ブラウザ対応・サイズ・位置に制約。透明な全画面枠には不適。本アプリでは未実装 |

OBS用URL: `https://kkodamalab.github.io/presentation-frame-timer/?mode=obs&duration=600`

背景透過で自動開始します。Browser Sourceを映像の上に置き、幅・高さを出力と一致させます。`duration`は1〜7200秒。ブラウザ設定ページとの同期はなく、再読み込みで再スタートします。「表示されていないときにソースをシャットダウン」「シーンがアクティブになったときにブラウザを更新」はOFFにします。実際のOBS/Zoom接続は別途実機確認が必要です。

公式資料:
- https://www.electronjs.org/docs/latest/api/browser-window
- https://obsproject.com/kb/browser-source
- https://developer.chrome.com/docs/web-platform/document-picture-in-picture/

## 開発と検証

Node.js 22以降。

```sh
npm ci
npm run dev
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

ブラウザテストは別ターミナルでdevサーバーを起動して実行します。`BASE_URL`環境変数で公開版を対象にできます。
0/10/25/50/75/100%のスクリーンショットと、実際のCanvasピクセルの連結成分数を確認します（0%は0個、その他は1個）。全画面・単色・太さ・停止/再開/終了・保存・390px幅・OBS表示も検証します。出力は`test-results/`。

GitHub ActionsはPRでテスト・ビルド、mainへのマージで同じ検証後GitHub Pagesにデプロイします。ブラウザ撮影画像はActionsの`browser-evidence` artifactに保存します。外部フォントが利用できなくてもシステムフォントで動作します。

スマホ検証はChromiumの390px幅エミュレーションであり、iPhone/Android実機・Safari・OBS・Zoom実機の検証は含みません。全画面非対応環境ではメッセージを表示します。

## Windowsデスクトップ版（Electron）

配布先: [GitHub Releases](https://github.com/kkodamalab/presentation-frame-timer/releases/latest)
（Release未公開の場合はダウンロードできません。ActionsのWindows desktop → windows-installersにも生成物を保存します。）

Windows 10/11 x64向け。`Presentation-Frame-Timer-Setup.exe` を実行してインストールします。
インストール不要の `Presentation-Frame-Timer-Portable.exe` も生成します。
コード署名は設定していません。SmartScreenの警告が出る場合があります。配布元・Release・ファイルを確認し、信頼できる場合だけ「詳細情報」から実行してください。組織のセキュリティ規則を優先してください。

1. 投影PCでZoomを起動し、受信する共有画面をプロジェクターへ表示する。
2. Frame Timerを起動し、「投影先モニター」でプロジェクターに対応する画面を選ぶ。名称・DIP解像度・拡大率・座標を表示します。
3. 発表時間を秒で設定（10分は600秒）。色・太さ・透明度・残り時間・通知を設定する。
4. STARTを押す。左上から上→右→下→左へ一本のゲージが伸びます。
5. 操作パネルは他のモニターへ自動移動します。単一画面・複製表示ではパネルを閉じて隠してください。タイマーは続きます。
6. トレイアイコンをダブルクリック、または右クリック→「操作パネルを表示」で戻す。PAUSE/RESUME、RESETで操作します。終了後は100%で停止し、再度始めるにはRESETします。
7. アプリ全体の終了はトレイの「終了」。パネルの×では終了しません。

透明・枠なし・最前面・タスクバー非表示・フォーカス不可・マウス透過のウィンドウを選択画面の `bounds` に配置します。中央は完全透明です。
WindowsのDIP座標をscreen APIのまま使用し、CanvasはdevicePixelRatioに応じて描画します。接続・切断・解像度/拡大率変更で再配置し、選択画面を失った場合は主画面へ退避します。
複製表示はWindowsが論理的に一つの画面として公開する場合があり、同じ映像を複製している画面へ別々のゲージは設定できません。

最前面はOSや対象アプリによって制限されます。排他的フルスクリーン、UACのセキュアデスクトップ、ロック画面には重ねられません。ブラウザの全画面・PowerPointスライドショー・Zoom全画面は実機確認が必要です。上位の最前面ウィンドウが隠す場合もあります。
**投影PCの画面に重ねる機能であり、Zoomの送信映像への合成を保証しません。** 受信した共有画面を投影する目的で使用してください。特定ウィンドウだけの共有にはゲージが含まれないことがあります。

タイマーの唯一の状態はメインプロセスにあり、単調増加時計の実経過時間で計測します。フレーム数には依存しません。50ms間隔で両ウィンドウへ同期します。終了時は停止し、点滅を有効にすると約4秒点滅後に100%を保持します。効果音は操作パネルのAudioContextをSTARTまたは音ONの操作で有効化し、パネルを隠しても通知します。OS側の音量・ミュートの影響を受けます。アプリ終了・PC再起動ではタイマーと設定はリセットします。

セキュリティ: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`。preloadは固定の操作・設定・画面選択・状態取得だけを公開し、メイン側で値と送信元を検証します。オーバーレイからの変更要求は拒否します。外部への要求・新規ウィンドウ・ナビゲーション・権限要求を拒否し、アプリの実行時に外部通信は不要です。

### デスクトップ開発・配布

```sh
npm ci
npm run desktop:install
npm test
npm run desktop
npm run test:electron
npm run desktop:pack
# Windows上でインストーラーとポータブル版を作る
npm run desktop:win -- --publish never
```

`desktop:install` はElectronを公式配布元からチェックサム検証付きで取得します。
Windows CIはPR/mainで単体テスト、Webビルド、Electron統合テスト、NSIS/portableビルドを実行し、生成物をartifactへ保存します。
`v1.1.0` 等のバージョンタグをpushすると、同じ検証後にGitHub Releaseへexeを添付します。
Web版のPagesデプロイは従来どおり独立して継続します。

Linuxクラウドのキャッシュ保存先が読み取り専用の場合は `npm_config_cache`, `XDG_CACHE_HOME`, `electron_config_cache`, `ELECTRON_BUILDER_CACHE` を `/workspace` 以下に指定します。
Electronの取得にNodeのプロキシ対応が必要な環境ではNode 24の `NODE_USE_ENV_PROXY=1` を使用します。TLS/チェックサム検証を無効化しないでください。
GUIテストには実際のデスクトップが必要です。LinuxではXorg/Xvfbとウィンドウマネージャーが必要です。既存Chromiumを使う場合は `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`。

詳細な実行結果とWindows実機チェックリストは [docs/windows-validation.md](docs/windows-validation.md) を参照してください。
