---
title: "gemini-cliとtmuxを使った最先端のコーディングを体験する"
description: "無料枠の大きいgemini-cliとtmuxを組み合わせて、複数エージェントによる並列コーディングを体験する"
pubDate: 2025-07-21T08:30:00+09:00
tags: []
heroImage: ./images/20250702012012.png
---

## 大CLIエージェント時代

AIによるコーディングが流行りだしてから、あっという間についていけないところまで行ってしまったという感覚があります。

最近はClaude CodeのMaxプランが登場し、私の観測範囲では猫も杓子もClaude CodeでVibe Codingしてるんじゃないか？というレベルで流行ってます。

そこでちょっと気になるものがこのtmuxを使用したこれ

[ツイート: 画面は神威/KAMUIをHaconiwa（箱庭）を使って16並列実装を行っている様子🥳自分のPCの実装画面なんだけど、…](https://twitter.com/kamui_qai/status/1936417773133197819)

これやりたい。

でもこういうのはトークンを消費しまくるからかなり及び腰でしたが、先日リリースされた`gemini-cli`でならなんとかなりそう！

[Gemini CLI : オープンソース AI エージェント | Google Cloud 公式ブログ](https://cloud.google.com/blog/ja/topics/developers-practitioners/introducing-gemini-cli)

[cloud.google.com](https://cloud.google.com/blog/ja/topics/developers-practitioners/introducing-gemini-cli)

なんとこれ、個人アカウントだと1日1000リクエストまで無料とのこと。 太っ腹すぎる。

ということで、gemini-cliとtmuxで並列実行での開発を体験していきます。

## 環境準備

ここからはWSL Debian12で作業を進めていきます。

### gemini-cli

まずはgemini-cliをインストールします。

インストール方法はGitHubにあるリポジトリのREADME.mdを参照します。

公式ではNode.jsのver18以上を推奨していますが、私は個人的に[bun](https://bun.sh/)が好きなので`bun add`でいれます。

```sh
# インストール
$ bun add -g @google/gemini-cli

# 起動
$ gemini
```

初回起動すると認証を求められます。 APIキーを入力する方法とGoogleアカウントでの認証と主に2つの方法があります。 今回は個人アカウントで使いたいのでGoogleアカウントでの認証にしました。認証はブラウザ経由でできるのでここは非常にありがたいです。

これで`gemini-cli`は準備できました。

### tmux

次にtmuxを入れていきます。

```
$ sudo apt install tmux
```

tmuxは`~/.tmux.conf`でvimのように設定を記述することができます。

今回はtmuxのコマンドはほぼAIが使うので特に設定はしません。

#### tmuxのコマンドについて

これを読めば大体OK

[とほほのtmux入門 - とほほのWWW入門](https://www.tohoho-web.com/ex/tmux.html)

今回重要なのはペインを割るコマンドと、別ペインにキー入力を送るコマンド。

キー

説明

Ctrl + b -> "

ペインを縦方向に分割

Ctrl + b -> %

ペインを横方向に分割

tmux send-keys -t %N ~

ペイン番号Nのペインにキー入力を送る

## tmux + gemini-cliでコーディングをやっていく!

ツールの準備が完了したら次はgemini-cliがtmuxを効果的に使用してくれるようにルールを整備していきます。

tmuxで複数ペインでのAIエージェント実行は上司と部下的な組み合わせで行うのが、巷で話題のパターンなのでこれを体験してみます。

### ミニマムなパターンで体験していく

まずは上司としてのmanagerペインと部下としてのdeveloperペインの2つである程度動かせるものかを試していきます。

この形でうまくいくなら、それを拡張していくことで夢が広がるってスンポーです。

#### 初期プロンプトを作る

それぞれのペインで最初に読ませるプロンプトとなるファイルを作ります。

`manager.md`

````markdown
このファイルを読んだ後はユーザーからの指示を待ってください。
# managerの役割

managerはユーザーから受けた指示をタスク単位で分解して`task.md`に書き出します。
タスクはチェックボックス形式で書き出し、進捗状況を記録できるようにしてください。
タスクは並列実行可能な単位でステップを区切ってください。
`task.md`に書き出したタスクを、developer対して割り当てて実装をさせます。
並列実行可能なタスクはdeveloperを複数利用して、並走させてください。
`task.md`が既に存在している場合は削除して再度新しく作成してください。

タスクはなるべく具体的な実装の方針に至るまで細かく分解してください。

mangerは自らコーディングをおこないません。

developerがmanagerに対して報告をしてきますので、報告を受けたらその内容を確認して次の指示を出します。

## developerへの指示について

developerは1, 2, 3と3つのエージェントが動いています。
managerはこれらを並行して指示します。
`task.md`の内容に基づき指示を送ります。
指示を送るときは必ず`task.md`を参照して、現在の進捗状況を確認してから指示を出します。
指示を送ったら、送り先のdeveloper番号を`task.md`に追記し、そのタスク内容をどのdeveloperに割り振ったのか確認できるようにしてください。

内容を送ってからenterを送るまでは1秒待機することを徹底してください。
pane番号はdeveloperがいるpaneの指定とdeveloperに対しての通知を兼ねています。

managerは以下の形式でtmuxコマンドを実行して、developerに指示を送信します。

バッククォートをはじめとする記号を指示に含める際は必ずエスケープしてください。

```
tmux send-keys -t \<pane番号> "[task:to:\<pane番号>]指示内容"
sleep 1
tmux send-keys -t \<pane番号> Enter
```

## developerからの報告について

developerからmanagerへの報告は`[report:from:<pane番号>]`の接頭辞を持つ形で入力されます。
報告を受け取ったら`task.md`を確認し、developerには次のタスクを指示してください。

# ユーザーからの指示を完了した場合の処理

`task.md`に書き出したユーザーからの要件を達成した場合は作業内容をまとめてユーザーに返してください。
````

このファイルを読んだ後はmanagerからの指示を待ってください。

## DeveloOerの役割

managerから具体的な指示をされるのでそれに合わせてコーディングを行ってください。

コーディングの進捗については

複数回同じ事象に遭遇するなど、解決が難しいと思われる課題についてはmanagerに報告を行い指示を仰いでください。

managerからdeveloperへの指示は`[task]`の接頭辞を持つ形で入力されます。

### 報告を行う際のコマンドについて

内容を送ってからenterを送るまでは1秒待機することを

報告内容を送った後にenterを押して報告を確定させます。

```
tmux send-keys -t 0 "[report][from:pane1]報告内容"
sleep 1
tmux send-keys -t 0 Enter
```

```
`developer.md`
```

このファイルを読んだ後はmanagerからの指示を待ってください。

## DeveloOerの役割

managerから具体的な指示をされるのでそれに合わせてコーディングを行ってください。

複数回同じ事象に遭遇するなど、解決が難しいと思われる課題についてはmanagerに報告を行い指示を仰いでください。

developerは3体いるので自分が何番目のdeveloperであるかはmanagerからの指示を見て確認してください。

### managerからの指示について

managerからdeveloperへの指示は`[task:to:<pane番号>]`の接頭辞を持つ形で入力されます。

`<pane番号>`は自身が何番目のdeveloperであるかを示す番号です。

### 報告を行う際のコマンドについて

内容を送ってからenterを送るまでは1秒待機することを徹底してください。

```
tmux send-keys -t 0 "[report:from:<pane番号>]報告内容"
sleep 1
tmux send-keys -t 0 Enter
```

````
### tmuxのペインとgemini-cliを用意する

tmuxのペインの構成とgemini-cliの起動までは人の手でやっていく必要がありそうです。（スクリプト化をして短縮はできそう。）

まずはtmuxを準備

```
$ tmux
```

起動したら`tmux splitw -h"で画面を横に分割できます。これを繰り返して、全部で4つの画面に分割しましょう。
分割した画面はCtrl + b -> Spaceで自動調整できるのでいい感じのレイアウトにしてください。
<figure class="figure-image figure-image-fotolife" title="4分割したtmux">[f:id:Ruc_4130:20250714085137p:plain]<figcaption>4分割したtmux</figcaption></figure>

ここからすべてのペインでgemini-cliを起動します。

```
## このコマンドを両方のペインで実施
gemini --yolo
```

gemini-cliが起動出来たら、pane0のmanagerペインでは`@prompts/manager.md`を実施してマネージャーとしての役割を認識させます。
pane1~3のdeveloperペインでは`@prompts/developer.md`を実施してデベロッパーとしての役割を認識させます。

```
## managerのpane(pane:0)
@prompts/manager.md
```

```
## developerのpane(pane:1~3)
@prompts/developer.md
```

mdファイルに記載した通り、読んだら指示を待ってくれます。
<figure class="figure-image figure-image-fotolife" title="指示待ち">[f:id:Ruc_4130:20250714090204p:plain]<figcaption>指示待ち</figcaption></figure>

準備が整うとこんな感じになります。
<figure class="figure-image figure-image-fotolife" title="準備OK">[f:id:Ruc_4130:20250714090849p:plain]<figcaption>準備OK</figcaption></figure>

あとは、manager役のpane0に作ってみたいものの指示を出してみましょう。
いい感じにdeveloper側のpaneを動かしながら物を作ってくれたりします。

# 結局

面白いは面白いんだけどpaneを連携させることによる効果はそこまで感じられなかったかなという印象。
タスク次第ではdeveloper1台だけしか動いてなくて他2台が暇してるとか、manager <-> developer間でタスクが延々とループしてしまったりとなかなかうまくいかない瞬間も多かったです。
ここら辺はLLMの性能による可能性もあります。Claudeならもっとよく動くのかな？
````
