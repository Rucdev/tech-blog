---
title: "NetConfigを読む【Ansible】"
description: "Ansibleのネットワーク機器向けコレクションの根幹にあるNetConfigクラスのソースを読み解く"
pubDate: 2023-03-20T00:56:17+09:00
tags: []
---

## NetConfig?

`NetConfig`はAnsibleのネットワーク機器向けコレクションにおいてその根幹にあるともいえるクラスになります。  
これを読むことはAnsibleのネットワーク機器設定の仕組みを読み解くことにもつながります。

ということで、後世（1ヶ月後くらいの自分）のためにも読み解いた証を記していきます。

### NetConfigクラス
