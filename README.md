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
- `src/characters/model.js`：フォールバックモデルと共通リグ生成。GLBの対応付けは `src/characters/gltf.js`
- `src/characters/animation.js`：行動別ポーズ、歩行、呼吸、手振り
- `src/world/house.js`：家、3Dプリンタ構造、照明
- `src/world/furniture.js`：家具定義、操作位置、障害物サイズとモデル
- `src/simulation/actions.js`：行動ラベル、継続時間
- `src/simulation/life.js`：自律選択、家具予約、移動・実行の状態管理
- `src/simulation/navigation.js`：家具を避けるグリッドA*
- `src/ui.js` と `src/style.css`：日本語UI

家具を増やす際は定義とモデルを追加し、行動を追加する際はactionsとanimationに対応を加えます。移動の到着点は家具の外側に置きます。家具は1人ずつ利用します。キャラクター同士の厳密な衝突、冷蔵庫の扉や調理器具の物理演算、保存機能は含まない軽量な初期実装です。フォント取得ができない場合はシステムフォントに切り替わります。


## Blender GLBへの差し替え

プロジェクト直下の `assets/characters/chicken.glb`（ちきん）、`assets/characters/piyokichi.glb`（ぴよきち）へ配置し、開発サーバーを再起動、公開時は再ビルドしてください。片方のみでも使用できます。Viteが配置済みGLBを検出して出力へ含め、GitHub Pagesのサブパスにも対応します。

`src/characters/gltf.js` がGLTFLoaderで非同期読み込みし、検証成功後に見た目だけを置換します。未配置時は通信せず、破損・部品不足の場合も既存proceduralモデルを維持します。モデル制作は `model.js`、読み込みと対応付けは `gltf.js`、起動時の呼び出しは `main.js` に分離しています。

### GLB制作ルール

現段階は独立したメッシュ部品を既存ピボットで動かす方式です。単一結合メッシュ、スキニング済みArmature、GLB内のアニメーションクリップ再生には未対応です。各GLBに以下の名前のオブジェクトまたはグループを1個ずつ用意し、各部品にメッシュを含めます。全メッシュを6部品のいずれかへ所属させ、名前付き部品同士は親子にしません。

| 名前 | 役割 | 中立時ピボット：ちきん / ぴよきち |
|---|---|---|
| Body | 胴体、尾など固定部品 | (0,0,0) |
| Head | 頭、顔、トサカ | (0,1.01,0) / (0,.69,0) |
| Wing_L | -X側の翼 | (-.30,.67,0) / (-.195,.45,0) |
| Wing_R | +X側の翼 | (.30,.67,0) / (.195,.45,0) |
| Leg_L | -X側の脚 | (-.14,.25,0) / (-.11,.25,0) |
| Leg_R | +X側の脚 | (.14,.25,0) / (.11,.25,0) |

座標は書き出したglTF座標（+Yが上、+Zが顔の前）です。Blenderの書き出し時の軸変換を考慮してください。モデル全体の原点は(0,0,0)、足裏Y=.01の中立姿勢で制作します。部品原点が異なっても中立姿勢を保って既存ピボットへ接続します。自動サイズ調整はしません。現行の寸法は `src/characters/model.js` を参照してください。

VR・本・食べ物・ほうきは既存パーツを使うためGLBに含めません。VRの頭ローカル位置は(0,.025,.34) / (0,.025,.30)です。顔と後頭部の寸法を現行モデルに合わせ、VRと寝姿勢の接触を確認してください。テクスチャを内包するGLBを推奨します。圧縮用デコーダは設定していません。

rootの位置・回転・スケール、家具アンカーと行動処理は不変です。読み込みが睡眠や歩行中に完了しても、中立座標で接続します。独自骨格への対応は行動側ではなく `gltf.js` を拡張してください。読み込み結果は `visualReady`（Promise<boolean>）、`visualSource`、失敗理由は `visualLoadError` に保持します。
