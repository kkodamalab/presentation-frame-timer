# 検証記録とWindows実機チェックリスト

実施環境: 2026-10-21、Debian 13 Linuxクラウド、Node 24.19.0、Electron 44.9.2。
Windows実機、Zoom、PowerPoint、プロジェクターはこの環境にありません。

## 実行済み

- `npm test`: 6件成功。既存ゲージの周長、タイマー計測、停止/再開/リセット、100%停止、設定入力検証。
- `npm run build`: Web版の静的ビルド成功。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: 既存の全ブラウザチェック成功。0/10/25/50/75/100%で連結成分数が0または1、配色、太さ、全画面API、停止/再開/終了、保存、390px幅、OBS透明表示。
- `npm run test:electron` (Xorg :99 + xfwm4): 実際のElectronで透明背景、中央の透明ピクセル、隔離/sandbox設定、IPC入力と送信元検証、両ウィンドウの状態同期、パネルを閉じても継続、再表示、表示ON/OFF、終了・リセットを確認。
- 共通Canvas描画: 1600×900 / 900×1600 / 1920×1080、DPR 1 / 1.5 / 2、グラデーションと単色のそれぞれ0/25/50/75/100%で一本の連続ゲージを確認（30条件）。
- Linuxのxfwm4では画面全体サイズが1 DIP縮む挙動を観測。Linuxの統合テストのみ1 DIPの差を許容し、Windowsではboundsの完全一致を要求。
- `node tests/linux-overlay.mjs`: 独立したChromiumプロセスの上に実際に赤いフレームを表示。XTestのOS入力で中央と左ゲージ上にそれぞれクリック/ホイールを送り、背後のChromiumで両方2件ずつ受信したことを確認。CDPで全画面を要求したが、物理Windowsの全画面テストには相当しない。
- `npm run desktop:pack -- --publish never`: Linux用アプリパッケージ生成成功。
- Windowsアプリ本体のクロスパッケージ生成成功。NSISインストーラーの生成はLinuxにWineがないため失敗。Windows CIの結果は別途確認が必要。

画像・JSONレポートは `test-results/`（Git対象外）。Windows CIでは `desktop-evidence`、Web CIでは `browser-evidence` artifactへ保存します。
Linuxでは `DISPLAY=:99 XDG_CACHE_HOME=/workspace/.cache XDG_CONFIG_HOME=/workspace/.config` を指定してGUIテストを実行しました。

## Windows実機で未完了の必須確認

以下はすべて**未検証**です。CI上のElectronテストが通っても、この表の完了を意味しません。

| 対象 | 確認内容 | 記録する証拠 |
| --- | --- | --- |
| Zoom | 通常/最大化/全画面、共有者や共有対象の切替後も残る、クリック/スクロール透過 | Windows/Zoomバージョン、録画、結果 |
| PowerPoint | 通常/スライドショー、スライドやウィンドウ切替 | Office版、録画、結果 |
| ブラウザ | 通常/最大化/F11、クリック/スクロール透過 | ブラウザ版、録画、結果 |
| モニター | 主画面/副画面/プロジェクターへの切替、負の座標 | 拡張/複製設定、画面配置、結果 |
| 解像度/DPI | 100/125/150/200%、解像度変更、接続/切断時の退避 | 各画面の解像度/DPI、録画、結果 |
| ゲージ | 0/25/50/75/100%、一本で時計回り、両配色、太さ/透明度 | 各時点のスクリーンショット |
| タイマー | START/PAUSE/RESUME/RESET、裏へ切替、100%停止 | 録画と経過時間 |
| 終了通知 | 約4秒点滅、実際に音が鳴る、パネルを閉じた場合も動作 | 音声付き録画 |
| 操作 | パネル×でも継続、トレイから復帰、トレイ終了、二重起動 | 録画、結果 |
| 配布物 | NSISインストール/起動/アンインストール、portable起動、SmartScreen | ReleaseとSHA256、Windows版、結果 |

排他的フルスクリーン、UACセキュアデスクトップ、ロック画面は重ね合わせの保証対象外。
画面共有へのゲージ含有はキャプチャ対象/方式に依存します。投影PCで受信画面の上に表示する用途と、送信画面への合成を混同しないでください。
