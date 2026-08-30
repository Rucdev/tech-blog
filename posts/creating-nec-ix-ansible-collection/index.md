---
title: "NEC IX対応のAnsible Collectionを作ってみた"
date: 2022-12-09T09:00:00+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2022/12/09/090000"
description: "AnsibleのCollection作ってみた"
---

## Ansible Collection

NECのUniverge IXシリーズ対応コレクションを作成しました。 ただしモジュールは簡単なcommandとconfigの変更ができるだけで課題は山積みです。

### 環境作成

まずはPythonの仮想環境を作成します。 インストールしたパッケージは下記になります。 パッケージ管理ツールでpoetryを使っているのでtomlからの抜粋になります。

```toml
[tool.poetry.dependencies]
python = "^3.10"
ansible = "^6.4.0"
paramiko = "^2.11.0"
ansible-pylibssh = "^1.0.0"
```

### コレクションの雛形を作成する。

まずは `ansible-galaxy`コマンドでコレクションの雛形を作ります。  
`ansible_collections`という名前のディレクトリを作った後、`ansible-galaxy colleciton init`コマンドで作成します。  
また、いずれはAnsible Galaxyに挙げられたらいいなと思うのでnamespaceは自分のGitHubの名前にします。

参考  
[Creating collections](https://docs.ansible.com/ansible/latest/dev_guide/developing_collections_creating.html#creating-a-collection-skeleton)  
[\[Ansible\] 自作のコレクションを作ってGalaxyで公開するまで](https://qiita.com/zaki-lknr/items/4771b65b2385591e0678)

```shell
# ディレクトリを作成
mkdir ansible_collections
# 作成したディレクトリへ移動
cd ansible_collections
# コレクションの雛形を作成
ansible-galaxy init rucdev.ix
```

これで `ansible_collections/rucdev/ix/`の中身は下記のようになります。

```
.
├── README.md
├── docs
├── galaxy.yml
├── plugins
│   └── README.md
└── roles
```

ここから主に `plugins`ディレクトリ以下にコレクションを構成するプラグインとモジュールを書いていきます。

モジュールなどを呼び出す際のFQCNは `namespace.コレクション名`となるので `rucdev.ix`になります。

なので、`ix_config`なるモジュールを作ったときにプレイブックからは `rucdev.ix.ix_config`で呼び出します。

ここから下の内容は既存モジュールのソースコードを読みながら、各機器とIXシリーズの機器の差異を埋められるように見様見真似で作ったものなります。ただ、私自身オブジェクト指向やメタプログラミングについての知識が浅いのでややコピペになっている部分があることは否めないです。

-   [cisco.ios](https://github.com/ansible-collections/cisco.ios)
-   [yamaha.rtx](https://github.com/yamaha-network/ansible-collection-rtx)
-   [junipernetworks.junos](https://github.com/ansible-collections/junipernetworks.junos)

yamahaのモジュールが比較的コンパクトな実装になっているので、それを見て最低限必要なものを揃えて、足りなそうなところはciscoとjuniperのモジュールを見ながら作っていました。

### Pluginを作る

他のネットワーク機器と同じように `inventory`ファイルで `ansible_network_os`への指定をできるようにします。その際の `network_os`は `rucdev.ix.ix`で設定できるように下記の２つのPluginを作っていきます。

-   Terminal Plugin
-   Cliconf Plugin

#### Terminal Pluginを作る

Terminal Pluginは機器のプロンプトやエラーメッセージについてをキャッチするための正規表現を設定したり、`become`で特権に入るための手順と機器から抜けるための手順などを設定します。  
まずはTerminal Pluginを書くためのディレクトリとファイルを用意します。  
`plugin`ディレクトリの下に `terminal`というディレクトリを作り、その中にTerminal Pluginを書くファイルを置きます。  
`ansible_network_os=rucdev.ix.ix`で呼べるようにしたいので、ファイル名は `ix.py`とします。

`ansible_network_os`の指定の部分は`<namespace>.<collection>.<plugin>`の並びになっています。

```
# ansible_collections/rucdev/ix/
.
├── README.md
├── docs
├── galaxy.yml
├── plugins
│   ├── terminal - 追加
│   │   ├── __init__.py - 追加
│   │   └── ix.py - 追加
│   └── README.md
└── roles
```

Terminal Pluginは `netcommon`モジュールの `TerminalBase`クラスを拡張した `TerminalModule`という名前のクラスを作ってその中に機器に合わせた形の挙動を記述します。  
※ちなみに `TerminalBase`を継承した `TerminalModule`というクラス名でないときちんと呼び出しが出来ません。

```python
from ansible_collections.ansible.netcommon.plugins.plugin_utils.terminal_base import (
    TerminalBase,
)

class TerminalModule(TerminalBase):
    # 以下に設定を記述します。
    pass
```

こんな感じになりました。  
[terminal/ix.py](https://github.com/Rucdev/ix_ansible/blob/main/ansible_collections/rucdev/ix/plugins/terminal/ix.py)

#### Cliconf Pluginを作る

次にCliconf Pluginを作っていきます。 Cliconf Pluginは機器との接続する部分のラッパーを提供します。 公式曰くCLIインターフェースを抽象化したもののようです。 手順としてはTerminal Pluginの時と同じです。

まずはディレクトリとファイルを用意します。

```
# ansible_collections/rucdev/ix/
.
├── README.md
├── docs
├── galaxy.yml
├── plugins
│   ├── cliconf - 追加
│   │   ├── __init__.py - 追加
│   │   └── ix.py - 追加
│   ├── terminal
│   │   ├── __init__.py
│   │   └── ix.py
│   └── README.md
└── roles
```

この `cliconf/ix.py`に `netcommon`モジュールの `CliconfBase`クラスを継承した `Cliconf`クラスを作成します。

```python
from ansible_collections.ansible.netcommon.plugins.plugin_utils.cliconf_base import (
    CliconfBase,
)

class Cliconf(CliconfBase):
    # 以下に設定を記述します。
    pass
```

詳細は下記  
[cliconf/ix.py](https://github.com/Rucdev/ix_ansible/blob/main/ansible_collections/rucdev/ix/plugins/cliconf/ix.py)

### moduleを作る

#### module\_utilsを作る

Cliconf PluginとTerminal Pluginが出来たら、モジュール作成に移る前に、`module_utils`にモジュールから参照するコマンド実行用ラッパーを作成します。

```
# ansible_collections/rucdev/ix/
.
├── README.md
├── docs
├── galaxy.yml
├── plugins
│   ├── cliconf 
│   │   ├── __init__.py
│   │   └── ix.py
│   ├── terminal
│   │   ├── __init__.py
│   │   └── ix.py
│   ├── module_utils - 追加
│   │   ├── __init__.py - 追加
│   │   └── network - 追加
│   │       ├── __init__.py - 追加
│   │       └── ix - 追加
│   │           ├── __init__.py - 追加
│   │           └── ix.py - 追加
│   └── README.md
└── roles
```

この `module_utils/network/ix/ix.py`にはCliconf Pluginで書いたCLIインターフェースを抽象化したメソッドを `AnsibleModule`クラスと合わせた形でモジュール側で呼び出せるように作ります。

ここの部分はこれまでのPlugin以上によくわからず書いているので、特筆することがないです。  
ほぼほぼコピペ。

[module\_utils/network/ix/ix.py](https://github.com/Rucdev/ix_ansible/blob/main/ansible_collections/rucdev/ix/plugins/module_utils/network/ix/ix.py)

#### moduleを書く

ここまで来てようやくモジュールを書き始められます。

まずはshowコマンド系を打つモジュールとCLIコマンドでの設定変更をするモジュールの2つをつくりたいとおもいます。  
モジュール名は `cisco.ios`に習って `ix_command`と `ix_config`にします。

まずはモジュールの本体となるファイルを用意します。

```
# ansible_collections/rucdev/ix/
.
├── README.md
├── docs
├── galaxy.yml
├── plugins
│   ├── cliconf 
│   │   ├── __init__.py
│   │   └── ix.py
│   ├── terminal
│   │   ├── __init__.py
│   │   └── ix.py
│   ├── module_utils
│   │   ├── __init__.py
│   │   └── network
│   │       ├── __init__.py
│   │       └── ix
│   │           ├── __init__.py
│   │           └── ix.py
│   ├── modules - 追加
│   │   ├── __init__.py - 追加
│   │   ├── ix_command.py - 追加
│   │   └── ix_config.py - 追加
│   └── README.md
└── roles
```

どちらのモジュールも流れとしては下記になります。

```mermaid
graph LR
    A(モジュールが持てるパラメータを定義) --> A2(AnsibleModuleクラスを呼び出す)
    A2 --> B(モジュールの持つオプションなどに対応する処理)
    B --> C(冪等性に関する処理)
    C --> D(コマンドの送信)
    D --> E(結果の解釈)
```

この上記の流れをそれぞれの、Pythonファイルの `main`関数内で行います。

そんなこんなで出来上がったのが下記。

[modules/ix\_command.py](https://github.com/Rucdev/ix_ansible/blob/main/ansible_collections/rucdev/ix/plugins/modules/ix_command.py)  
[modules/ix\_config.py](https://github.com/Rucdev/ix_ansible/blob/main/ansible_collections/rucdev/ix/plugins/modules/ix_config.py)

### 実際にプレイブック内で使ってみる

ではここからは実際に作ったコレクションを用いてNEC Univerge IXシリーズに接続してみたいと思います。

#### ansible.cfgへ設定

プレイブックを動かす前に、先に今回作成したコレクションを参照するための設定を入れます。

```
# IXコレクションを開発しているディレクトリ
.
├── ansible_collections
│   └── rucdev
│       └── ix - 先程まで作成していたコレクション
└── ansible.cfg - 追加
```

`ansible.cfg`ファイルに下記を記述。

```ini
[defaults]
collections_path = /home/user/.ansible/collections:/usr/share/ansible/collections:./
```

これで今回作成したコレクションも呼び出せるようになりました。 ホームディレクトリと `/usr/share/`配下のコレクションもパスに入れているのはIXへの接続時に使用する `network_cli`を提供する `netcommon`を呼べるようにするためです。

### プレイブックを書いてみる

準備も出来たところで簡単なプレイブックを書いてみます。

```
.
├── ansible_collections
├── ansible.cfg
└── ix_demo.yaml - 追加
```

`ix_demo.yaml`の中身は下記のようにしてみました。

```yaml
---
- hosts: ix
  gather_facts: false
  tasks:
    - name: show ip interface Loopback0.0
      rucdev.ix.ix_command:
        commands:
          - show ip interface Loopback0.0
      register: pre_status

    - name: pre check
      ansible.builtin.debug:
        msg: "{{ pre_status.stdout_lines[0] }}"
        
    - name: set ip address
      rucdev.ix.ix_config:
        lines:
          - ip address 10.0.0.1/24
        parents: interface Loopback0.0
    
    - name: show ip interface Loopback0.0
      rucdev.ix.ix_command:
        commands:
          - show ip interface Loopback0.0
      register: post_status

    - name: post check
      ansible.builtin.debug:
        msg: "{{ post_status.stdout_lines[0] }}"
```

インターフェース`Loopback0.0`へのIPアドレスの設定とその事前事後確認を行うプレイブックです。

そして`inventory`ファイルはこんな感じ。

```ini
[ix]
ix_test ansible_host=<ip address>
[ix:vars]
ansible_network_os=rucdev.ix.ix
ansible_connection=network_cli
ansible_user=<username>
ansible_password=<password>
```

これを動かすとこんな感じでできました。

```
PLAY [ix] *********************************************************************************************************************************************************

TASK [show ip interface Loopback0.0] ******************************************************************************************************************************
ok: [ix_test]

TASK [pre check] **************************************************************************************************************************************************
ok: [ix_test] => {
    "msg": [
        "Interface Loopback0.0 is dormant, line protocol is down",
        "  Internet protocol processing disabled"
    ]
}

TASK [change description] *****************************************************************************************************************************************
changed: [ix_test]

TASK [show ip interface Loopback0.0] ******************************************************************************************************************************
ok: [ix_test]

TASK [post check] *************************************************************************************************************************************************
ok: [ix_test] => {
    "msg": [
        "Interface Loopback0.0 is up, line protocol is up",
        "  Internet address is 1.1.1.1/24",
        "  Broadcast address is 255.255.255.255",
        "  Address determined by config",
        "  MTU is 1500 octets",
        "  Directed broadcast forwarding is disabled",
        "  Proxy ARP is disabled",
        "  Local proxy ARP is disabled",
        "  ICMP redirects are never sent",
        "  TCP MSS adjustment is disabled"
    ]
}

PLAY RECAP ********************************************************************************************************************************************************
ix_test                    : ok=5    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

事前事後のshowコマンドも取れていて設定もできている。良さそうですね。

冪等性のチェックとして同じプレイブックをもう一度流すと、、、

```
PLAY [ix] *********************************************************************************************************************************************************

TASK [show ip interface Loopback0.0] ******************************************************************************************************************************
ok: [ix_test]

TASK [pre check] **************************************************************************************************************************************************
ok: [ix_test] => {
    "msg": [
        "Interface Loopback0.0 is up, line protocol is up",
        "  Internet address is 1.1.1.1/24",
        "  Broadcast address is 255.255.255.255",
        "  Address determined by config",
        "  MTU is 1500 octets",
        "  Directed broadcast forwarding is disabled",
        "  Proxy ARP is disabled",
        "  Local proxy ARP is disabled",
        "  ICMP redirects are never sent",
        "  TCP MSS adjustment is disabled"
    ]
}

TASK [change description] *****************************************************************************************************************************************
ok: [ix_test]

TASK [show ip interface Loopback0.0] ******************************************************************************************************************************
ok: [ix_test]

TASK [post check] *************************************************************************************************************************************************
ok: [ix_test] => {
    "msg": [
        "Interface Loopback0.0 is up, line protocol is up",
        "  Internet address is 1.1.1.1/24",
        "  Broadcast address is 255.255.255.255",
        "  Address determined by config",
        "  MTU is 1500 octets",
        "  Directed broadcast forwarding is disabled",
        "  Proxy ARP is disabled",
        "  Local proxy ARP is disabled",
        "  ICMP redirects are never sent",
        "  TCP MSS adjustment is disabled"
    ]
}

PLAY RECAP ********************************************************************************************************************************************************
ix_test                    : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

今度は`ok`になりました。  
これで冪等性についても良さそうです。（この一点においては）

### 課題

なんやかんやで上手くいっているように見えますが、このコレクションには課題が山積しています。

-   IXのconfigureモードは同時に１人しか入れない仕様をクリアしていない  
    これはIXの仕様によるものでconfigureモードは1機器1セッションしか許可されていないので、Ansible実行時に誰かが対象のIXでconfigureモードで作業しているとエラーが出てしまいます。
-   ドキュメントが全く書けていない  
    ドキュメントの量がなかなか多いので書けていない状況です。自動生成するツールもあるようですがまだ調査不足なので今後対応します。
-   エラーコマンドの収集不足  
    Terminal pluginを作るにあたり、IXが出すエラー出力を正規表現で設定する必要がありますが、IXが出すエラーについてはマニュアルにも詳細な記述が見当たらなかったので 自分で調べる必要がありました。ただこれがかなり難しい。どこまでで収集しきったといえるかもわからないのでこれは永遠に続く課題かもしれません。（メーカーの人間になれば話は変わるでしょうが）

そんな感じで使うにはもう一歩な感じはありますが、コレクションを作る中でAnsibleのコアな部分に触れられたのでやってみてよかったなと思います。  
今後はぼちぼちでこのモジュールをよりよくしていければと思います。
