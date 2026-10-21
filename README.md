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
| Electronの透明・最前面・クリック透過ウィンドウ | 発表者自身のZoom/PowerPoint画面に枠を重ねる | 専用デスクトップアプリの追加開発が必要。本リポジトリでは未実装 |
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
