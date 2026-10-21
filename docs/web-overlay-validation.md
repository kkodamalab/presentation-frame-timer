# WEB OVERLAY（実験版）の検証

2026-10-21。Document Picture-in-Pictureの実ウィンドウと、通常のpopupやブラウザ内デモは区別しています。成功パスではAPIをモックしていません。

## ローカルで実行済み

Debian 13、実際のXorg/xfwm4、Chromium 154.0.8037.57で `npm run test:pip` を実行。

- クリックから実際の `documentPictureInPicture.requestWindow()` を呼び、独立したPiPを起動。
- グラデーション・単色それぞれ0/25/50/75/100%で、SVGを画像化したピクセルの連結成分数が0または1であることを確認。maskのpathは一本、中央のSVGピクセルは透明。
- OSウィンドウの実サイズを2段階変更し、実際の内寸に合わせたviewBoxと周長の再計算を確認。
- COMPACT / FRAME、暗色/単色/CSS透明、色・太さ・不透明度・残り時間ON/OFF・位置の同期を確認。
- START / PAUSE / RESUME / RESET、別タブへの切替・PiPのフォーカス変更、閉じて再度開いた際の継続、100%で停止を確認。ブラウザによってはPiPがある元タブをvisible扱いにするため、visibilityStateの値だけでバックグラウンド検証済みとは判断しません。
- 非対応とNotAllowedErrorは別のコンテキストで明示的にシミュレートし、通常タイマーが引き続き操作できることを確認。
- 既存Web版のブラウザテスト、Electronの実ウィンドウ統合テスト、単体テスト8件、静的ビルドも実行。

## Windows CIで実行する確認

Windows desktop workflowで、インストール済みの **Google Chrome** と **Microsoft Edge** をそれぞれheadfulで起動し、同じ実PiPテストを行います。
追加で別プロセスのメモ帳を最大化・前面化し、user32で前面アプリがメモ帳であることを確認してから、OSデスクトップ全体を撮影します。赤いPiPゲージのピクセルが残ることを検証し、暗色/単色の中央ピクセルとCSS透明時のネイティブ表示ピクセルを記録します。

`test-results/pip-chrome-report.json` / `pip-msedge-report.json` にブラウザ版、OS、実際の内寸・周長、連結成分、背景実験、実行チェックを保存します。`desktop-evidence` artifactにスクリーンショットとJSONを保存します。
公開PagesのCIではXvfb上のChromiumで同じPiPテストを行い、既存Web回帰・ビルドとともに確認します。結果は `browser-evidence` artifact。

Electronの既存OS入力透過テスト、インストーラー/portableビルド、インストーラー後のアプリ統合テストも維持します。加えて **生成したPortable.exeそのもの** を起動して、展開後のアプリの操作パネル・オーバーレイ・タイマーの開始/停止/再開/終了/リセットをCDP経由で確認します。デバッグ用の起動引数はこのテストだけで使用し、通常起動時にデバッグポートを有効にするコードは追加していません。

CIの成功と、物理Windows PCでのZoom・PowerPoint確認は同一ではありません。

## 未検証と保証しないこと

- 物理Windows PC上でのZoom・PowerPointとの重ね合わせ、プロジェクター、マルチモニター/DPI、排他的フルスクリーン。
- PiPのネイティブ透過。CSS透明の実験とOSピクセルの記録だけで背後が透けると断定しません。
- 任意の位置・サイズ、Zoom画面全体の四辺、UAC画面への最前面表示。
- クリック透過（実装不可）。PiPが覆う領域では背後を操作できません。
- Zoom送信映像への合成・実スピーカーの通知音。

元タブの再読込/終了ではタイマーを保持しません。PiPだけを閉じた場合は元タブで継続します。
