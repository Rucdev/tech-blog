---
title: "Ansibleはネットワーク機器のConfigをどのように理解しているのか【NetworkConfig】"
description: "ベンダーモジュールの~_configで冪等性管理に使われるNetworkConfigクラスがネットワーク機器のコンフィグをどう解釈するのかを追う"
pubDate: 2023-05-23T23:59:06+09:00
tags: []
---

## Ansibleでネットワーク機器を扱う

Ansibleでネットワーク機器を扱う際には、各ベンダが出しているAnsibleモジュールを使ってPlaybookを記述するのが一般的である。  
多くのベンダーモジュールでは`~~_config`というCLIでのコンフィグ入力を模したモジュールが存在する。

今回はその`~~_config`で冪等性の管理に使われているNetworkConfigクラスがどのようにネットワーク機器のコンフィグを解釈するのかを順を追ってみていく。

### 既存のベンダーモジュールでのNetworkConfigクラスの使われ方

#### 冪等性はどこで担保されているか

### NetworkConfigクラス
