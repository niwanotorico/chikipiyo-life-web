# ちきぴよ暮らし

Three.js + Viteで動く、小さな自律生活シミュレーション。

## ローカル実行

Node.js 20.19以上または22.12以上で実行します。

```sh
npm install
npm run dev
```

ターミナルに表示されるURLを開きます。編集はホットリロードされます。

```sh
npm run build
npm run preview
npm test
```

## GitHub Pagesでスマホ確認

1. このプロジェクトを公開先のGitHubリポジトリへpushします（`package-lock.json` と `.github/workflows/pages.yml` も含めます）。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. デフォルトブランチ（`main` または現在の `master`）へpushすると、テスト成功後に自動公開します。初回設定後や再実行時は **Actions → Deploy to GitHub Pages → Run workflow** でデフォルトブランチを選びます。
4. Actionsの `github-pages` に表示される公開URLをスマホで開きます。通常は `https://<ユーザー名>.github.io/<リポジトリ名>/` です。PCを起動し続ける必要はありません。

公開するのはビルド済みの `dist` のみです。Pagesが返すパスをビルド時に指定するため、リポジトリ名や独自ドメインに合わせてソースを変更する必要はありません。通常のローカル起動・ビルドの設定も維持します。デフォルトブランチが `main` / `master` 以外の場合は、ワークフローの `push.branches` を合わせてください。

スマホでは1本指ドラッグで回転、ピンチでズーム、2本指でパンできます。画面を下へスクロールするとキャラクター選択・家具の操作欄があります。

公開前にサブフォルダでの読み込みをローカル確認する場合:

```sh
npm run build -- --base /chikipiyo-life-web/
npm run preview -- --base /chikipiyo-life-web/
```

表示されたサーバーURLの `/chikipiyo-life-web/` を開きます。公開設定の参考: [Vite公式のGitHub Pages手順](https://vite.dev/guide/static-deploy.html#github-pages)。

## 操作

- ドラッグ：回転、ホイール／ピンチ：ズーム、右ドラッグ／2本指移動：パン
- 右のカードでキャラクターを選び、家具をクリックして行動を指示
- 一時停止は移動・行動・生活時計を止めます。視点は操作可能です
- 家のボタンで初期視点に戻ります

## 差し替え場所

- `src/characters/config.js`：名前、色、初期位置。仮のオリジナル造形です
- `src/characters/model.js`：モデルとリグ生成。GLTFに替える場合も同じリグ契約を返すか、animation側にアダプターを用意
- `src/characters/animation.js`：行動別ポーズ、歩行、呼吸、手振り
- `src/world/house.js`：家、3Dプリンタ構造、照明
- `src/world/furniture.js`：家具定義、操作位置、障害物サイズとモデル
- `src/simulation/actions.js`：行動ラベル、継続時間
- `src/simulation/life.js`：自律選択、家具予約、移動・実行の状態管理
- `src/simulation/navigation.js`：家具を避けるグリッドA*
- `src/ui.js` と `src/style.css`：日本語UI

家具を増やす際は定義とモデルを追加し、行動を追加する際はactionsとanimationに対応を加えます。移動の到着点は家具の外側に置きます。家具は1人ずつ利用します。キャラクター同士の厳密な衝突、冷蔵庫の扉や調理器具の物理演算、保存機能は含まない軽量な初期実装です。フォント取得ができない場合はシステムフォントに切り替わります。
