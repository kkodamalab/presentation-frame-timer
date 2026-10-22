# Presentation Frame Timer

発表時間を、画面外周を時計回りに進む一本の線で表示するWebアプリ。

- 公開: https://kkodamalab.github.io/presentation-frame-timer/
- リポジトリ: https://github.com/kkodamalab/presentation-frame-timer

## 使い方

時間を選びSTART。PAUSE / RESUMEで中断・再開、RESETで先頭へ戻ります。
1秒〜120分、5つのプリセット、グラデーションと任意の単色、3〜40pxの太さ、残り時間の位置・文字サイズ・不透明度、終了時の点滅・音を設定できます。
デモスライダーは操作時に停止し、本番時には非表示にできます。設定をlocalStorageに保存します。実行状態は再読み込みでリセットします。

FULLSCREENはブラウザのFullscreen APIです。ZoomやPowerPointを透過表示する機能ではありません。Zoomの共有対象が切り替わっても、このページを開いたままであればタイマーは継続します。画面共有にフレームを含めたい場合はOBS等の合成が必要です。

## 描画と計測

CanvasとPiP SVGは共通の**単一の塗りつぶしリボン形状**をマスクとして使います。外周は表示領域の端、内周は太さ分だけ内側に置き、両方の四隅を90度にします。画面外にはみ出すストロークや角丸を使いません。左上→上辺→右辺→下辺→左辺の順で、進行率0%は非表示、100%は四辺と四隅を完全に埋めます。

グラデーションは周長上の固定距離に対応する青→水色→緑→黄→赤。辺ごとの色面を角の対角線で接続し、単一パスで切り出します。線分の繰り返しではありません。開始色・終了色は変更可能です。100%の左上には開始色と終了色の境界があります。

Date.now()との差分で経過時間を算出し、requestAnimationFrameは再描画のみに使用。バックグラウンドから戻ると実時刻に追従します。OS時計の手動変更の影響は受けます。ブラウザがバックグラウンド処理を停止すると通知音は復帰時まで遅れる場合があります。音声はユーザーがSTARTを押したときに有効化し、OBSの自動開始では保証しません。

## インストール不要：WEB OVERLAY（実験版）

公開URLをWindowsの対応Chrome / Edgeの通常タブで開き、上部の **WEB OVERLAY（実験版）** を直接クリックするとDocument Picture-in-Pictureを開きます。拡張機能やアプリのインストールは不要です。非対応・起動拒否の場合はメッセージを表示し、そのまま通常Web版を操作できます。APIにはHTTPSまたはlocalhostとユーザー操作が必要です。

1. 元タブで発表時間・色・太さ・残り時間・表示位置・不透明度・通知を設定する。
2. **COMPACT**（中央に大きな残り時間）または **FRAME**（PiP自身の四辺ゲージ）を選ぶ。
3. WEB OVERLAYを押し、PiPを邪魔にならない場所へ手動移動・リサイズする。
4. 元タブのSTART / PAUSE / RESUME / RESETで操作する。設定と実時間ベースのタイマーはPiPへ即時反映される。PiP内にアプリの操作ボタンは配置しない。
5. PiPを閉じても元タブのタイマーは継続し、再度開くと現在の経過時間を引き継ぐ。**元タブを閉じる・再読み込みすると、PiPと実行中タイマーは終了する。**

PiPのSVGは既存の `perimeterPoints` と `colorAt` を共有し、左上→上→右→下→左の一本の連続パスをmaskとして使います。四つの色面は一本の線の配色であり、複数の短いゲージではありません。実際の `innerWidth` / `innerHeight` をresize/ResizeObserverで読み、SVG viewBox・パス・周長・グラデーションを再計算します。元タブと別のタイマーは作りません。PiP表示中はPiP側のrequestAnimationFrameも同じ状態を描画します。

**ブラウザPiPはElectronの透明・クリック透過オーバーレイの代替にはなりません。**

- FRAMEで囲むのはPiPウィンドウの外周です。Zoom / PowerPoint / デスクトップ全体の外周へ自由に一致させられる保証はありません。
- サイズ・位置・最前面表示はOS/ブラウザが管理します。要求した初期サイズが採用されないことがあります。最大サイズ、配置、全画面との重なり、他の最前面ウィンドウとの順序には制約があります。
- **クリック透過ではありません。** PiPが覆う場所のクリック・スクロールは背後のアプリへ届きません。ブラウザ自身のタイトルバー・戻る/閉じる操作も残ります。
- 背景は既定で暗色です。「単色」と「透過を試す」を選択できます。透過はCSS背景を透明にする実験であり、OSが背後を透かす保証はありません。CSSの計算値がtransparentでもネイティブウィンドウが透過した証拠にはならず、自動判定は行いません。透明にならないときは暗色か単色を使ってください。
- ゲージ/文字の不透明度を下げても、ウィンドウ全体のOS透明度は変わりません。
- Zoomへの重ね合わせと画面共有の送信映像への合成は別です。共有映像に含まれることは保証しません。排他的フルスクリーンやUAC画面に重なる保証もありません。

Chrome/Edgeの機能は実行時に検出します。Safari / FirefoxなどAPIがない環境は通常Web版へフォールバックします。Zoom・PowerPointと物理Windows PC上での実機検証は未完了です。
検証方法と結果の範囲は [docs/web-overlay-validation.md](docs/web-overlay-validation.md) を参照してください。

## Windowsでのオーバーレイ

| 方法 | 適する用途 | 制約 |
| --- | --- | --- |
| Electronの透明・最前面・クリック透過ウィンドウ | 発表者自身のZoom/PowerPoint画面に枠を重ねる | Electron版を同梱。実機での重なり・共有映像への含有はアプリやOSの表示方式に依存 |
| OBS Browser Source | 配信・録画・共有映像への合成 | Zoomの通常ウィンドウに直接重なるわけではない。OBSの合成結果を共有する |
| Document Picture-in-Picture | 小さな最前面タイマー | WEB OVERLAY（実験版）で実装。PiP自身の枠のみ。OS透過・クリック透過・任意配置は保証不可 |

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
# PiPの実ウィンドウが必要（Linux CIではxvfb-runを使用）
npm run test:pip
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

タイマーの唯一の状態はメインプロセスにあり、単調増加時計の実経過時間で計測します。フレーム数には依存しません。50ms間隔で両ウィンドウへ同期します。終了時は停止し、点滅を有効にすると設定した1〜60秒（初期値4秒）だけ点滅し、100%の通常表示に戻ります。効果音は独立した非表示ウィンドウで再生し、操作パネルを隠しても通知します。OS側の音量・ミュートの影響を受けます。アプリ終了・PC再起動ではタイマーをリセットします。音声・点滅の設定は保存します。

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
Windows CIはPR/mainで単体テスト、Webビルド、Electron統合テスト、独立したEdgeに対するWindows OS入力とデスクトップ撮影の検証、NSIS/portableビルドを実行し、生成物をartifactへ保存します。
`v1.1.0` 等のバージョンタグをpushすると、同じ検証後にGitHub Releaseへexeを添付します。
Web版のPagesデプロイは従来どおり独立して継続します。

Linuxクラウドのキャッシュ保存先が読み取り専用の場合は `npm_config_cache`, `XDG_CACHE_HOME`, `electron_config_cache`, `ELECTRON_BUILDER_CACHE` を `/workspace` 以下に指定します。
Electronの取得にNodeのプロキシ対応が必要な環境ではNode 24の `NODE_USE_ENV_PROXY=1` を使用します。TLS/チェックサム検証を無効化しないでください。
GUIテストには実際のデスクトップが必要です。LinuxではXorg/Xvfbとウィンドウマネージャーが必要です。既存Chromiumを使う場合は `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`。

詳細な実行結果とWindows実機チェックリストは [docs/windows-validation.md](docs/windows-validation.md) を参照してください。

## v1.2.0：音声とタイマー操作

v1.1.0のElectron操作パネルでは、START等の前に `await AudioContext.resume()` を実行していました。音声デバイスや初期化の状況によってこのPromiseが保留すると、タイマーコマンドまで届かなくなる不具合がありました。v1.2.0ではコマンドを先に送信し、音声の準備・失敗・保留から完全に分離しています。計測は従来どおり実経過時間ベースです。

Web版・Electron版共通で、ブザー（初期値）、ベル／鈴、アラート、犬の鳴き声、チャイム、電子音を選べます。音量は共通の0〜100%（初期値50%）、0%は無音です。「▶ 試聴」は終了音OFFでも使用でき、連打時は前の音を停止して最新の要求だけを再生します。音声を有効にできない場合は専用の警告を表示しますが、START / PAUSE / RESUME / RESETは継続して使用できます。

Electronは音声専用の非表示ウィンドウ（sandbox/contextIsolation有効、nodeIntegration無効）から再生します。操作パネルの×で非表示にしても終了音は継続できます。メインプロセスが終了到達を1回だけ通知し、RESET後に再び通知できます。終了後にパネルを再読込しても終了音を重複送信しません。音声の種類・音量・ON/OFFをElectronのuserData内 `audio-settings.json` に保存し、次回起動に引き継ぎます。その他の設定・タイマー実行状態の再起動時リセットは従来どおりです。

Web版はユーザーのSTART・音ON・試聴クリックで音声を有効にします。音声初期化には1.5秒の上限を設け、拒否・保留・デバイスエラーを警告します。元タブがブラウザに停止された場合の通知の遅延や、自動再生制限は引き続きブラウザに依存します。

5種類はWeb Audio合成音で、保守的な出力ゲインとDynamicsCompressorでピークを制限しています。犬の自然な録音はローカルWAV同梱（CC BY-SA 3.0、Amada44）。6dB減衰・半振幅未満へのピーク制限・フェードを施し、再生ゲインにも上限を設けています。OS側の音量や外部アンプの増幅は別です。

素材の出典、ライセンス、変更内容、SHA-256は [audio/ATTRIBUTION.md](audio/ATTRIBUTION.md) に記載しています。Windows配布には `AUDIO-CREDITS.md` も同梱し、Releaseにも添付します。音声再生時の外部通信は不要です。

```sh
npm run test:audio:web       # devサーバーが必要
npm run test:audio:electron  # 実GUIが必要
```

テストの範囲は [docs/audio-validation.md](docs/audio-validation.md) を参照してください。CIのAPI呼び出し・波形検証は、人間が実スピーカーで音を聴いた確認とは区別します。


## v1.3.0：音声・点滅の時間と直角の四隅

- 効果音の持続時間：1〜60秒、1秒刻み、初期値5秒。6種類すべてを維持し、短い音は反復、犬の録音はループします。指定時間の終わりに短くフェードアウトします。
- 点滅時間：1〜60秒、1秒刻み、初期値4秒。約0.65秒周期で、実際の終了時刻から指定時間だけ点滅します。音声の時間やON/OFFとは独立です。
- Web／PiP／Windowsで同じ四角いゲージ形状を使います。太さ3〜40pxに対応し、端の余白や丸い角をなくしました。

操作パネル下部で時間を入力し「▶ 試聴」。音声OFFでも設定した長さで試せます。再試聴は前の音を置き換え、RESETは音と点滅を停止します。STARTは音声初期化を待ちません。Webはブラウザ内、Windowsはユーザーデータ内に時間設定を保存します。操作欄が画面に収まらないときはスクロールしてください。

[ポータブル版](https://github.com/kkodamalab/presentation-frame-timer/releases/download/v1.3.0/Presentation-Frame-Timer-Portable.exe) ／ [Setup版](https://github.com/kkodamalab/presentation-frame-timer/releases/download/v1.3.0/Presentation-Frame-Timer-Setup.exe) ／ [Release](https://github.com/kkodamalab/presentation-frame-timer/releases/tag/v1.3.0)。署名なしのためSmartScreenの警告が出る場合があります。配布元とReleaseのSHA-256を確認してください。v1.2.0は引き続き旧Releaseから取得できます。

検証方法と四隅の拡大比較は [v1.3.0検証記録](docs/v1.3.0-validation.md) を参照してください。

## v1.3.1：操作パネルと残り時間表示

操作パネルは作業領域と内容の実測サイズに合わせて起動し、広い画面では3列、小さい画面では2列／1列になります。収まらない場合は縦スクロールでき、リサイズも可能です。手動変更したサイズと位置を次回復元し、モニター切断等で画面外になった場合は補正します。

「残り時間を表示」の下で、文字サイズ12〜120px（初期28）、文字色（初期白）、9位置（初期右上）、文字透明度0〜100%（初期100）、余白0〜100px（初期24）を設定できます。投影画面の縮小プレビューに即時反映し、ゲージの透明度とは独立しています。Web／PiPも同じ設定を使います。小さい表示領域では文字を画面内に収めるため縮小します。設定中もタイマーは進行し、設定は次回へ保存します。

[ポータブル版 v1.3.1](https://github.com/kkodamalab/presentation-frame-timer/releases/download/v1.3.1/Presentation-Frame-Timer-Portable.exe) ／ [Setup版 v1.3.1](https://github.com/kkodamalab/presentation-frame-timer/releases/download/v1.3.1/Presentation-Frame-Timer-Setup.exe) ／ [Release](https://github.com/kkodamalab/presentation-frame-timer/releases/tag/v1.3.1)。旧v1.3.0は保持します。検証範囲・スクリーンショットについては [v1.3.1検証記録](docs/v1.3.1-validation.md) を参照してください。
