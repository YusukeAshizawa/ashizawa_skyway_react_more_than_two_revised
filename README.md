このリポジトリはCOMMチーム所属（2026年3月現在）芦沢の個人研究において用いたプログラムをまとめてあるリポジトリです．
必要に応じて活用してみてください．

# 動かし方

ビデオ通話システム自体へのリンク：https://yusukeashizawa.github.io/ashizawa_skyway_react_more_than_two_revised/

## ローカル上で動かす場合

0. VSCodeをインストールする（インストールしなくても使えるかもですが，以下の手順はVSCode上のターミナルで動かす想定です．）
1. 本リポジトリをクローンする
2. クローンしたリポジトリをVSCodeで開き，VSCode内でターミナルを起動する
3. ターミナル内で「npm install」コマンドを実行する
4. ターミナル上にて，本リポジトリ内の「./examples/large-room」に移動した上で，wslを導入する（参考サイト：https://learn.microsoft.com/ja-jp/windows/wsl/install ）
5. wslを導入出来たら，ターミナル上にて，本リポジトリ内の「./examples/large-room」において「wsl」コマンドを実行する
6. 5.を行った状態にて，ターミナル上で「npm run dev」コマンドを実行する
7. 6.を実行すると，プログラムが立ち上がります！

## リモート上で動かしたい場合（Github Pagesを利用する想定）

0. 「ローカル上で動かす場合」の手順を実行する
1. 新規に作成したリポジトリ（本リポジトリを保存しておきたい場所）に本リポジトリ一式をローカルからPushする
2. 新規リポジトリを作成出来たら，ローカル環境において，VSCode内のターミナル上にて「./examples/large-room」に移動し，「npm run deploy」コマンドを実行する
3. 数秒～数分待つ
4. 新規リポジトリが保存されているアカウント（おそらく，自分自身のアカウント？）経由で，新規リポジトリ内の「Settings → Pages」に移動
5. 「Visit Site」または「https://（新規リポジトリ）」のリンクを選択
6. 5.を実行すると，プログラムが立ち上がります！

## プログラム（ビデオ通話システム）自体の動かし方

0. ビデオ通話システム自体へのリンクへのアクセス・「ローカル上で動かす場合」の手順の実行・「リモート上で動かしたい場合」の手順の実行のいずれかを行う
1. 参加者人数分だけ，画面を立ち上げる
2. 各画面において，「Your ID」を適当に設定する（実験用に作成したものであるため，厳密に設定したい場合以外は適当で問題ないです．）
3. 各画面において，「condition」を設定する（condition内の「Baseline」= 通常のビデオ通話を想定した場合，「FrameChange」= ビデオウィンドウの枠の色を変更する手法，「SizeChange」= ビデオウィンドウの大きさを変更する手法）
4. 各画面において，「room name」を入力する（このとき，「room name」は任意のものを設定可能だが，全画面（全参加者）において統一する必要がある）
5. 各画面において，4.までを実行すると，各参加者に対応するビデオウィンドウが表示されます！

## 備考（注意事項等）

- このリポジトリは今後も更新予定（2026年3月現在）であるため，上記の動かし方では動かない可能性があります．ご了承ください．
- 上記の「動かし方」の手順を試しても動かない場合には，「npm install」を再度やってみると解決するかもしれないです（必要なライブラリが追加でインストールされる可能性があるため）．
- エラーが発生した場合には，エラーコードを生成AIに聞いたり，検索したりすると解決するかもしれないです．
- wslを導入していないと，ローカル環境で実行できないです．ご注意ください．
- 「npm run dev」コマンドを実行する場所と「npm run deploy」コマンドを実行する場所は異なります（前者はwslを実行して立ち上がった仮想環境内，後者は仮想環境外）．ご注意ください．
- 実験説明書にシステム図が載っているため，参考にしてみてください．（リンク：https://docs.google.com/document/d/1mrBzc0-_iUwYtZYh0qWpYmIbiiR3RJMV/edit?usp=sharing&ouid=108709283499208545233&rtpof=true&sd=true ）
- その他気になることがあれば，芦沢に聞いてください．Slackでもメールでも可です．

# 参考情報

↓ 以下は参考情報（SkyWayのサンプルプログラム設置時に書かれていたこと）です．

## SkyWay JS-SDK

このリポジトリは、2023 年 1 月 31 日にリリースされた SkyWay の JavaScript SDK です。旧 SkyWay の JavaScript SDK とは互換性がありません。

## 本リポジトリの運用方針について

このリポジトリは公開用のミラーリポジトリであり、こちらで開発は行いません。

### Issue / Pull Request

受け付けておりません。

Enterprise プランをご契約のお客様はテクニカルサポートをご利用ください。
詳しくは[SkyWay サポート](https://support.skyway.ntt.com/hc/ja)をご確認ください。

## SDK のインストール方法

ユーザアプリケーションで利用する際は NPM と CDN の2通りのインストール方法があります

### NPM を利用する場合

npm がインストールされている環境下で以下のコマンドを実行します

**Room ライブラリ**

```sh
npm install @skyway-sdk/room
```

**Core ライブラリ**

```sh
npm install @skyway-sdk/core
```

**その他のプラグインやユーティリティライブラリ**

```sh
npm install @skyway-sdk/sfu-bot
npm install @skyway-sdk/token
```

### CDN を利用する場合

以下のスクリプト要素を HTML に追加します

**Room ライブラリ**

```html
<script src="https://cdn.jsdelivr.net/npm/@skyway-sdk/room/dist/skyway_room-latest.js"></script>
```

モジュールはグローバル変数の `skyway_room` に格納されるので以下のようにモジュールを取得することができます。

```js
const { SkyWayContext, SkyWayStreamFactory, SkyWayRoom } = skyway_room;
```

## ドキュメント

### 公式サイト

[https://skyway.ntt.com/ja/docs/user-guide/javascript-sdk/](https://skyway.ntt.com/ja/docs/user-guide/javascript-sdk/)

### API リファレンス

- [Room ライブラリ](https://javascript-sdk.api-reference.skyway.ntt.com/room)
- [Core ライブラリ](https://javascript-sdk.api-reference.skyway.ntt.com/core)
- [SFU Bot ライブラリ](https://javascript-sdk.api-reference.skyway.ntt.com/sfu-bot)
- [Token ライブラリ](https://javascript-sdk.api-reference.skyway.ntt.com/token)

## このリポジトリのセットアップ方法(環境構築)

このリポジトリのサンプルアプリを起動したり、SDK を利用者自身でビルドするために必要な手順。

### 初期設定時

- Node.js をインストールする（バージョンは v20.0.0 以降）
- corepack を有効化するために次のコマンドを実行する
  - `corepack enable pnpm`
- ルートディレクトリで次のコマンドを実行する
  - `pnpm run first`
- `env.ts.template`を`env.ts`にリネームし、ファイル中の appId と secret にダッシュボードで発行した appId と secret を入力する
  - appId と secret の発行方法は[こちら](https://skyway.ntt.com/ja/docs/user-guide/javascript-sdk/quickstart/#199)

### 更新時

git で更新を同期した時や packages ディレクトリ以下のソースコードを編集した際にはルートディレクトリで以下のコマンドを実行する必要がある。

```sh
pnpm run compile
```

## サンプルアプリの起動方法

- examples ディレクトリ以下の任意のサンプルアプリのディレクトリに移動する
- そのディレクトリで以下のコマンドを実行する

  - `npm i`
  - `npm run dev`

- コマンドを実行するとローカルサーバが起動するので Web ブラウザでアクセスする

## SDK のビルド方法

- 環境構築のセクションの作業を実施する
- ルートディレクトリで次のコマンドを実行する
  - `pnpm run build`

## License

- [LICENSE](/LICENSE)
- [THIRD_PARTY_LICENSE](/THIRD_PARTY_LICENSE)
