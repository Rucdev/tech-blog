---
title: "初めてのAnsible モジュール作成"
date: 2022-12-06T09:00:00+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2022/12/06/090000"
description: "初めてのAnsibleモジュール作成！"
---

本記事は「[エーピーコミュニケーションズ Advent Calendar 2022](https://qiita.com/advent-calendar/2022/ap-com)」の6日目のエントリとなります。

こんにちは！

今回はAnsibleのモジュール作成に挑戦していきます。  
とはいえ、Ansibleのモジュール作成については初めてなので簡単なモジュールを作成してAnsibleモジュールの仕組みについてより深く理解していきたいと思います。

## Ansibleのモジュール作成を学ぶ

Ansibleのモジュール作成については公式より解説ページ（[Developing modules — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/dev_guide/developing_modules_general.html)）が出ていますが、これでじゃあ始めようってなるのは私にはちょっとレベルが高すぎて出来ませんでした。

とっつきやす解説記事としてクラスメソッド様が出している下記の２つがわかりやすかったです。

-   [Ansibleのモジュール開発（基礎編） | DevelopersIO](https://dev.classmethod.jp/articles/ansible-develop-module-basis/)
    
-   [Ansibleのモジュール開発（Python実装編） | DevelopersIO](https://dev.classmethod.jp/articles/ansible-develop-module-python/)
    

### 仮想環境を用意する

まずは開発に使うためのPythonの仮想環境を用意します。  
venv、pipenvなど仮想環境の構築方法は色々ありますが、今回は[Poetry](https://python-poetry.org/)を使用しました。

```
poetry init
```

で仮想環境を作成し、あとは良しなに`ansible`を入れます。

### モジュールを入れるディレクトリを作る

ansibleのモジュールは呼び出すパスが決まっています。

[Adding modules and plugins locally — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/dev_guide/developing_locally.html)

今回はお試しモジュールなので取り敢えず、この環境内で動けば十分です。  
なので`Adding standalone local modules for selected playbooks or a single role`にある通り`library`のディレクトリを環境下に作成してその中にモジュールとして呼ぶPythonファイルを置いていきます。

ディレクトリ構造のイメージとしては下記になります。

```
.
├── library
│   └── モジュール.py --- モジュール本体
└── プレイブック.yaml --- 自作モジュールを呼び出して使うためのプレイブック
```

### モジュールを書く

ここからはモジュールの本体となるPythonコードを書いていきます。 Pythonでは`ansible.module_utils.basic`から`AnsibleModule`クラスをインポートでき、その`AnsibleModule`クラスでモジュールが受け取るパラメータなどを設定し、受け取ることが出来ます。

AnsibleModuleクラスについての詳細は下記を参照。

[Ansible Reference: Module Utilities — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/reference_appendices/module_utils.html)

```python
# AnsibleModuleクラスのインポート
from ansible.module_utils.basic import AnsibleModule

# モジュールとして呼び出された際の処理を記述
def main():
    # Playbookからのパラメータを受け取る
    module = AnsibleModule(
        argument_spec=dict(
            message=dict(
                type="str",
                required=True,
            )
        )
    )

if __name__ == '__main__':
    main()
```

上記では、ファイルが実行された際に`main`関数を呼び出すようにしています。  
そして`main`関数の`module = AnsibleModule()`の部分でPlaybook側からパラメータを受け取る処理をしています。  
パラメータは`argument_spec`で指定されたもののみ受け取ることが出来ます。

`argument_sepc`についての書き方はこちらを参照。

[Ansible module architecture — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/dev_guide/developing_program_flow_modules.html#argument-spec)

上記の`argument_spec`について

```python
    module = AnsibleModule(
        argument_spec=dict(
            # パラメータ名messageについての設定
            message=dict(
                # typeで引数の型を指定(int, str, list, etc...)
                type="str",
                # 必須のパラメータとして指定
                required=True,
            )
        )
    )
```

`argument_spec`の辞書をつくるときは`{}`ではなく`dict()`がよくつかわれている印象です。  
おそらくキー名でクォーテーションを打たなくてよいからかと思います。

Playbookから受け取ったパラメータは`module.params[<パラメータ名>]`で参照できます。

```python
    message = module.params['message']
```

これで参照できます。

あとは、普通にPythonとしての処理を記述したのちに最後は`return`ではなく`.exit_json()`が処理の正常終了となります。  
異常終了は`.fail_json`です。

-   `.exit_json(**kwargs)`  
    引数はキーワード引数となっておりモジュールが返すキーバリューを自由に定めることが出来ます。  
    ただしタスクの`changed`や`ok`はここの引数で`changed=True or False`で変わるためこのキーだけは重要。
-   `fail_json(msg, **kwargs)` msg\`が必須ですがその他は自由です。

プレイブックからのパラメータ取得やタスクへの結果の返し方がやや特殊ですが、それ以外はごく普通のプログラムです。

ということで簡単に作ってみました。

-   パラメータの`message`に応じた挨拶を返してくれる
-   対応できない場合はエラーになる

こんな感じ

```python
#! /usr/bin/python3
from ansible.module_utils.basic import AnsibleModule

def main():
    module = AnsibleModule(
        argument_spec=dict(
            message=dict(
                type="str",
                required=True,
            )
        )
    )
    reply = []
    greeting_msg = module.params["message"]

    if greeting_msg == "こんにちは":
        reply.append(
            [
                "_                    ,-､        _______________________",
                ".:ヾ、       ,へ、__ /. l       |                      |",
                ".   l       |  /     `ヽ|       |    こんにちワン!!    |",
                ">､__」    __ 人,/  tｯ    `ｰ┐    |                      |",
                "` ー―‐r'  :.     _ .. ┴ '′     /／¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯",
                "       ;   :.        `ｰ-r┘",
                ".      ;    :.､__ _ _ﾉ",
                "      ;   ;.   └ー-rｨ",
                "     ',.  `'  ,.. -ﾉ",
                "/`ｰ ､  }   ,: __, /",
                "    ` -{  ,r‐i´  l",
                "      l   l  ',.  |",
                "       |  |    '  |",
                "       |. l.    } l_",
                "       ', ヽ、 `:､_,.)",
                "        └-‐'",
            ]
        )
    elif greeting_msg == "ありがとう":
        reply.append(
            [
                "                        _______________________",
                "              ｧ､        |                      |",
                ".            i',ﾞ,      |    ありがとウサギ❤   |",
                ".           i ;',       |                      |",
                "          ...!. ﾞ ,     /／¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯",
                "        ,''      ﾞ ,          _ ,,..,,..,..,,.., _",
                "      , 'ﾞ  ●        ﾞヾ''''ﾞ´               ﾞ  ,",
                ".     {Y                                         ﾞ ,",
                "      ﾞ丶, _                                        ﾞ ,",
                "            ;                                           ﾞ",
                "             ;                                        ﾞ ,",
                "            ﾞ,                                        ﾞ",
                "              ﾞ,    ,   ,,          _ ,,.. ﾞ' ,,  , ﾞ",
                "                ﾞ,ﾞ  ,ﾞ,,..,,..,,..,,.,  ''ﾞ, ﾞ､  ヾ",
                "                  /   ,''|   :'       }   ,ﾞ ｀'   ,",
                "                 /   ,ﾞ  i   ﾞ       /  ,'    i   ",
                "                ﾉ   ,ﾞ  .!   ﾞ      /  ,'ﾞ    i   {",
                "             , ''´ ノ  r''  /ﾞ     ｧ''´ /   r', , !",
                "             ｀￣￣     ￣´       ￣￣ ´    ｀￣´",
            ]
        )
    else:
        module.fail_json(changed=True, failed=True, msg="ごめんなサイ🦏")

    module.exit_json(changed=False, reply=reply)

if __name__ == "__main__":
    main()
```

### 動かしてみる

モジュールのPythonファイルは`library`ディレクトリに置いたので特に設定なしで呼び出すことが出来ます。

プレイブックで今回作ったモジュールを指定してあげるだけでOKです。

```yaml
---
- hosts: localhost
  gather_facts: false
  tasks:
    - name: Hello!
      ac_greeting:
        message: こんにちは
      register: hello

    - name: Debug Hello
      debug:
        msg: "{{hello.reply}}"
```

こんにちワン！

```shell
PLAY [localhost] **************************************************************************************************************************************************

TASK [Hello!] *****************************************************************************************************************************************************
ok: [localhost]

TASK [Debug Hello] ************************************************************************************************************************************************
ok: [localhost] => {
    "msg": [
        [
            "_                    ,-､        _______________________",
            ".:ヾ、       ,へ、__ /. l       |                      |",
            ".   l       |  /     `ヽ|       |    こんにちワン!!    |",
            ">､__」    __ 人,/  tｯ    `ｰ┐    |                      |",
            "` ー―‐r'  :.     _ .. ┴ '′     /／¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯",
            "       ;   :.        `ｰ-r┘",
            ".      ;    :.､__ _ _ﾉ",
            "      ;   ;.   └ー-rｨ",
            "     ',.  `'  ,.. -ﾉ",
            "/`ｰ ､  }   ,: __, /",
            "    ` -{  ,r‐i´  l",
            "      l   l  ',.  |",
            "       |  |    '  |",
            "       |. l.    } l_",
            "       ', ヽ、 `:､_,.)",
            "        └-‐'"
        ]
    ]
}
```

このような形でオリジナルのモジュールを簡単に作ってみました。

完全にお遊びモジュールなので次は何か実用的なものを書きたいですね。
