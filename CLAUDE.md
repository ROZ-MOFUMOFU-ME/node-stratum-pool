# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

## マルチリポジトリ開発

このライブラリは、一体で開発される3リポジトリ構成の中間層です。**開発は `develop` ブランチで行い、`main` はリリース／プレリリース用です**（2026-06-13 に旧 dev/stable/old を main へ統合・整理し、その後 `develop` を切って開発を再開しました。区切りごとに develop → main をマージしてタグ（例 `v0.4.0-beta.0`）を切ります）。**このリポジトリの `main` は保護ブランチで直接 push が拒否されるため、develop → main はフィーチャーブランチ → PR でマージします**（GITHUB_TOKEN があれば API で PR 作成・マージ可能）。利用側はこのリポジトリを git 依存（`#main`＝リリース版）としてインストールします。兄弟リポジトリは隣のディレクトリにローカルクローンがある前提です:

```
../zny-nomp (ポータル本体, ESM/TypeScript)
  └─ stratum-pool (このリポジトリ — ESM/TypeScript, git 依存 ROZ-MOFUMOFU-ME/node-stratum-pool#main として公開)
       └─ multi-hashing = git: ROZ-MOFUMOFU-ME/node-multi-hashing#main → ローカルクローン: ../node-multi-hashing (ネイティブアドオン, JS のまま)
```

各兄弟リポジトリにもそれぞれ CLAUDE.md があります。重要なポイント:

- `multi-hashing` は**ローカルパスではなく GitHub の `#main` ブランチに固定**されています — `../zny-nomp` もこのリポジトリを同じ方式で利用します。ローカルの編集は `main` に push（PR 経由）するまでリポジトリ間に伝わりません。ローカルクローンをリンクする場合:

```bash
cd ../node-multi-hashing  && npm link              # ネイティブアドオンをビルド
cd .                      && npm link multi-hashing && npm link
cd ../zny-nomp            && npm link stratum-pool
```

- リンクせずに変更を zny-nomp に反映するには: このリポジトリの `main` に PR でマージしてから、zny-nomp で `npm update stratum-pool` を実行します。
- **リンクは npm install で消える**: このリポジトリや zny-nomp で `npm install` / `npm update` を実行すると、シンボリックリンクが GitHub クローンに置き換えられます。インストール後は `npm link multi-hashing`（zny-nomp 側は `npm link stratum-pool`）を再実行してください。ローカル修正が反映されない場合はまず `ls -la node_modules/` でリンクの有無を確認してください。
- **下流の API サーフェス**: zny-nomp はパッケージルート（`createPool`）に加えて、ディープパス（従来は `stratum-pool/lib/algoProperties.ts` と `stratum-pool/lib/util.ts`）をインポートしています。ソースは `lib/` から `src/` へ移行しましたが、`package.json` の `exports` に後方互換エイリアス `"./lib/*": "./src/*"` を張っているため、下流の旧 `lib/` パスは無修正で解決されます（新規参照は `stratum-pool/src/...` を推奨）。`src/*` 本体と `lib/*` エイリアスの双方を安定して保ってください。
- multi-hashing は NAN ネイティブアドオンです。Node のバージョンを切り替えるとテストが `Module did not self-register` で失敗します — `npm rebuild multi-hashing`（またはリンク済みの ../node-multi-hashing で `npm run build`）で直ります。Node 24 では `-std=c++20` でのビルドが必要です（`binding.gyp` で設定済み）。

## コマンド

```bash
npm test              # node --test（test/ 配下のスモークテスト: import + ダミー設定での createPool）
npm run lint          # eslint src/ test/（typescript-eslint）
npm run lint:fix
npm run format        # prettier --write
npm run format:check
npm run typecheck     # tsc --noEmit（型チェックのみ）
```

Node `>=22` が必要。`.nvmrc` は 24 を指定。コードスタイルは Prettier（4スペースインデント・100桁・シングルクォート・es5 トレーリングカンマ）と ESLint 9 フラット設定（`eslint.config.js` — このファイルだけは JS のまま）で強制されます。

ブランチ: `develop`（開発）、`main`（リリース／プレリリース、保護ブランチ、develop → main は PR でマージ）。Node 24 での動作確認済み。

## アーキテクチャ

ESM（`"type": "module"`）の TypeScript で、`src/` 配下に約4.3千行。**ビルド工程はありません** — Node のネイティブ型除去（Node 22.18+/24）で `.ts` を直接実行し、`npm run typecheck`（`tsc --noEmit`）で型のみ検査します（`tsconfig.json`: strict・nodenext。import 指定子は実拡張子＝`./foo.ts` のように書く。型のない `@exodus/bitcoinjs-lib-zcash` は `types/shims.d.ts` でアンビエント宣言）。package.json の `main` は `src/index.ts`（あわせて `exports` でルート `.`・`./src/*`・後方互換の `./lib/*` → `./src/*` を公開）。エントリポイント `src/index.ts` は `createPool(options, authorizeFn)` をエクスポートし、`Pool`（`src/pool.ts`）を返します。これが全体を結線するオーケストレータです。

シェアのライフサイクル — 大半のファイルをつなぐフロー:

1. **テンプレートのポーリング** — `src/daemon.ts`（複数デーモンへのフォールバック付き RPC クライアント）が一定間隔で `getblocktemplate` を呼びます。`src/peer.ts` は加えてデーモンに P2P ピアとして接続し、ポーリングより速く新ブロックを検知できます。
2. **ジョブ生成** — `src/jobManager.ts` が新しいブロック／高さを検知して `BlockTemplate`（`src/blockTemplate.ts`）を構築します。コインベースのシリアライズは `src/transactions.ts`（報酬・手数料・マスターノード出力）、マークルブランチは `src/merkleTree.ts` が担当します。
3. **ブロードキャスト** — `src/stratum.ts`（TCP stratum サーバー、最大のファイル）が購読中の全マイナーに `mining.notify` を送信します。ポートごとの難易度は固定、または `src/varDiff.ts`（シェア提出レートからリターゲット）が管理します。
4. **シェア検証** — `mining.submit` を受けると `jobManager.processShare()` がジョブ／nonce／ntime／重複をチェックし、ヘッダを再構築して `src/algoProperties.ts` のアルゴリズム別ハッシャーでハッシュします。ハッシュとターゲットの比較で有効シェア／有効ブロックが決まります。
5. **ブロック提出** — `pool.ts` がブロックをシリアライズして RPC で提出し、受理を確認してから `share` イベントを emit します。下流の zny-nomp がこれを Redis に永続化します。

`src/algoProperties.ts` はアルゴリズムレジストリです（50以上: scrypt 系、x11〜x25x、lyra2 系、yescrypt/yespower 系など）。各エントリは `{ multiplier, diff?, hash(coinConfig) → (data: Buffer) => Buffer }` で、内側の関数が `multi-hashing` のエクスポートをラップします。アルゴリズム追加 = ../node-multi-hashing で実装・エクスポートしてからここに登録（難易度の `multiplier` と、ブロックハッシュに `util.reverseBuffer` が必要かに注意）。

`src/stratum.ts` は接続ポリシーも実装しています: 購読管理、無効シェア連投の自動 BAN、接続タイムアウト、HAProxy `tcpProxyProtocol` 対応（任意）。
