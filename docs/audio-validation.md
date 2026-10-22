# Audio validation — v1.2.0

## 不具合と設計

v1.1.0の `electron/control.js` は操作の直前で `await arm()` を行っていたため、AudioContext.resumeが保留するとSTARTも待機していました。操作パネルは最初にタイマーIPCを送信し、音声準備は別要求にしました。音声処理は独立した非表示のsandbox付きウィンドウで行います。音声の状態によってタイマーコマンドを許可・拒否する分岐はありません。

共有 `audio-engine.js` はresumeに1.5秒の上限を設け、拒否・保留・再生エラーを警告します。最新の試聴だけが有効になり、既存の音は停止します。音量0では再生しません。合成音はゲイン上限とリミッターを通し、犬の音はピーク制限済みWAVにさらに再生音量上限を適用します。

## 実行するテスト

| 項目 | 確認方法 |
|---|---|
| A/B 音ON/OFFのSTART | Webと実Electron操作パネルのボタンから開始して実経過時間を確認 |
| C resume失敗 | 本物のAudioContextを使用し、resumeだけを拒否するテスト用ラッパーで確認 |
| D resume永久保留 | stateをsuspended、resumeを未解決Promiseにして、全操作と警告を確認 |
| E 6種類の試聴 | 本物のOscillator.start / HTMLMediaElement.playの呼び出しと、犬のローカルWAVのplay解決を確認 |
| F 0/50/100% | 表示値・保存・無音を確認し、OfflineAudioContextで5合成音の実波形とピークを測定。WAVのPCMピークも検査 |
| G/H 終了通知 | 1秒タイマーで1回だけ再生要求が届くこと、RESET後の2周期目も再生することを確認 |
| I パネル非表示 | 実BrowserWindow.closeでパネルを隠し、音声専用ウィンドウで再生APIが呼ばれることを確認。パネル再読込でも重複なし |
| J 時間設定 | 30秒/1分/3分/5分/10分をUIから設定、単体テストで同じ設定の実時間計測を確認。全長を待つ耐久試験ではない |
| K Web回帰 | 既存ゲージ/タイマー/保存/OBS/PiPテストを維持 |
| L Electron回帰 | ゲージ透明性・最前面・連続性、Windowsの独立Edge上でのOS入力透過を維持 |
| 設定の永続化 | Electronを本当に終了・再起動し、種類/音量/ON/OFFが復元されることを確認 |
| 実Portable.exe | 生成したexeを起動し、音ONのSTART、resume拒否/保留、同梱WAVの再生APIも確認 |

`npm test`、`npm run test:audio:web`、`npm run test:audio:electron` を実行します。Web音声テストはWindows CIでもChrome/Edgeそれぞれで実行します。終了音の重複確認には単音ブザーを使用し、API呼び出し数を数えます。アラートの仕様上の複数ビープと、通知の重複は区別します。

レポート: `test-results/audio-web-*-report.json` と `test-results/desktop-audio-report.json`。Windows CIでは `desktop-evidence` artifact、Web CIでは `browser-evidence` artifactへ保存します。

## 未検証の実音項目

- 人間が実際のWindowsスピーカー/ヘッドホンで6種類を聴いた確認。
- 実機での出力先切替、ケーブル抜き差し、音声デバイス未接続からの回復。
- 全指定時間を実時間で通した30秒〜10分の耐久試験。
- Zoom/PowerPointや物理マルチモニター上での実機確認（既存の制約と同じ）。

API拒否・保留と安全な警告の検証、非表示時のAPI呼び出し確認、実波形の有無/ピーク検査を、物理的に音が出た確認と表現しません。
