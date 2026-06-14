# Firebase 移行セットアップ手順

スキルマップの保存先を Google スプレッドシート（GAS）から **Firebase（Firestore）** に切り替えるための手順です。
アプリ本体（`index.html`）は今まで通り **GitHub Pages** で配信します。変えるのは「保存先」だけです。

## なぜ Firebase か
- 読込（起動）・保存がミリ秒級に。`enablePersistence` のキャッシュで起動も速い
- スキル評価は「セル＝1ドキュメント」なので、**別のセルを触る人同士は競合しない**（数人同時編集に強い）
- Google ログインで **@horizon.co.jp 限定**にできるので、GitHub Pages 公開でも社員のみ
- すでにスプレッドシート（Google）にデータを置いているので、信頼範囲は実質同じ

---

## 1. Firebase プロジェクトを作成
1. https://console.firebase.google.com/ にアクセス（horizon.co.jp アカウント推奨）
2. 「プロジェクトを追加」→ 名前を付けて作成（例：`skillmap`）

## 2. Firestore を有効化
1. 左メニュー「構築 > Firestore Database」→「データベースを作成」
2. **本番環境モード**で開始 → ロケーションは `asia-northeast1`（東京）推奨

## 3. ログイン（Authentication）を有効化
1. 左メニュー「構築 > Authentication」→「始める」
2. ログイン方法で **Google** を有効化して保存
3. 「設定 > 承認済みドメイン」に次を追加
   - `horizon-jit.github.io`（GitHub Pages 用）
   - （ローカル動作確認するなら）`localhost`

## 4. セキュリティルールを設定
1. 「Firestore Database > ルール」を開く
2. このリポジトリの `firestore.rules` の内容を貼り付けて「公開」
   - 「ログイン済み かつ @horizon.co.jp」のみ読み書き可、になります

## 5. Web アプリを登録して設定値を取得
1. 「プロジェクトの設定（歯車）> 全般」→ 下部「アプリ」→ Web アプリ（`</>`）を追加
2. 表示される `firebaseConfig`（`apiKey` / `authDomain` / `projectId` / `appId` など）をコピー
3. `index.html` 内の `const firebaseConfig={ ... }`（`YOUR_…` の箇所）を実際の値に置き換える
   - `apiKey` がクライアントに出ますが Firebase 仕様上それで正常です。安全性は上記ルール＋ログインで担保します
   - `apiKey` を実値にすると `USE_FIREBASE` が自動的に有効になり、保存先が Firestore に切り替わります

## 6. 既存データの移行（1回だけ）
1. 設定済みの `index.html` をブラウザで開き、Google でログイン
2. 「管理」タブ右上の **「現データをFirebaseへ移行」** ボタンを押す
   - 現在の GAS スプレッドシートの全データ（作業者・大分類・作業・評価・スナップショット・アバター）を
     Firestore にコピーします
3. 完了トーストが出たら自動で再読込されます。件数・点数が一致しているか確認

## 7. 仕上げ
- 問題なければ、`index.html` 末尾の `GAS_URL` と移行ボタンは将来的に撤去してOK（当面は残しても無害）
- バックアップ：Firebase コンソール、または gcloud で Firestore のエクスポートを定期取得すると安心

---

## データ構造（Firestore コレクション）
| コレクション | ドキュメントID | フィールド |
|---|---|---|
| `workers` | 作業者ID（W001…） | name, code, active, ord, avatarDataUrl |
| `categories` | 大分類ID（C001…） | code, name, color, order, active |
| `tasks` | 作業ID（T001…） | code, name, catId, order, hasDoc, link, active |
| `skills` | `タスクID\|作業者ID`（例 `T001\|W001`） | taskId, workerId, level |
| `snapshots` | 月（`2026-06`） | fill, risk, totals |

> アバター画像は 56px に縮小した小さな JPEG（データURL）を `workers` ドキュメントに直接保存します。
> サイズが小さいため Firebase Storage は使わず、設定を簡素にしています。
