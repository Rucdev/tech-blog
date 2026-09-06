---
title: "YAMLからもっとAnsible Playbookを理解する（その他編）"
date: 2022-05-13T22:48:21+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2022/05/13/224821"
---

## YAMLの公式ドキュメント等を見て面白いなと思ったところのメモ

-   [YAMLの公式ドキュメント等を見て面白いなと思ったところのメモ](#YAMLの公式ドキュメント等を見て面白いなと思ったところのメモ)
    -   [Flow Style](#Flow-Style)
    -   [Block Style](#Block-Style)
        -   [Block Scalar](#Block-Scalar)
        -   [Block Folding](#Block-Folding)
        -   [Explicit Block Mapping Entries](#Explicit-Block-Mapping-Entries)
    -   [Tag Prefix](#Tag-Prefix)
    -   [Anchor Alias](#Anchor-Alias)

### Flow Style

YAMLでは配列、キーバリューのデータ構造について記述するときに、インデントを活用したYAMLではなくインジケーターを使用した形でも記述が可能です。

```yaml
- [ 1, 2, 3 ]
- [ a, b, c ]
- [ x, y, z ]
```

これはすなわち、、、 以下の形と同義ということになるようです。

```yaml
- 
  - 1
  - 2
  - 3
-
  - a
  - b
  - c
- 
  - x
  - y
  - z
```

Ansibleで確認

プレイブック

```yaml
---
- hosts: localhost
  gather_facts: no

  vars:
    demo1:
      - [1, 2, 3]
      - [a, b, c]
      - [x, y, z]
    demo2:
      - 
        - 1
        - 2
        - 3
      - 
        - a
        - b
        - c
      - 
        - x
        - y
        - z

  tasks:
    - name: debug demo1
      debug:
        var: demo1
      
    - name: debug demo2
      debug:
        var: demo2
```

実行結果

```bash
PLAY [localhost] ****************************************************************************************************************************************************************************************

TASK [debug demo1] **************************************************************************************************************************************************************************************
ok: [localhost] => {
    "demo1": [
        [
            1,
            2,
            3
        ],
        [
            "a",
            "b",
            "c"
        ],
        [
            "x",
            "y",
            "z"
        ]
    ]
}

TASK [debug demo2] **************************************************************************************************************************************************************************************
ok: [localhost] => {
    "demo2": [
        [
            1,
            2,
            3
        ],
        [
            "a",
            "b",
            "c"
        ],
        [
            "x",
            "y",
            "z"
        ]
    ]
}

PLAY RECAP **********************************************************************************************************************************************************************************************
localhost                  : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

以上の結果をもって２つの書き方がAnsibleの処理においても同義になっていることがわかりました。  

キーバリュー構造についても同様に下記の２つは同義ということになります。

```yaml
a: b
{a: b}
```

ansibleで実行してみる プレイブック

```yaml
---
- hosts: localhost
  gather_facts: no

  vars:
    demo1: {first: 1, second: 2, third: 3}
    demo2:
      first: 1
      second: 2
      third: 3

  tasks:
    - name: debug demo1
      debug:
        var: demo1
      
    - name: debug demo2
      debug:
        var: demo2
```

結果 （表示時にキーでソートされています。）

```bash
PLAY [localhost] *************************************************************************************************************************************************************

TASK [debug demo1] ***********************************************************************************************************************************************************
ok: [localhost] => {
    "demo1": {
        "first": 1,
        "second": 2,
        "third": 3
    }
}

TASK [debug demo2] ***********************************************************************************************************************************************************
ok: [localhost] => {
    "demo2": {
        "first": 1,
        "second": 2,
        "third": 3
    }
}

PLAY RECAP *******************************************************************************************************************************************************************
localhost                  : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
 
```

キーバリューの方もこれで２つの書き方が同義であることが確認できました。

ちなみにAnsibleの方のドキュメントにはこれらはフローコレクションという形で書かれていました。

[YAML Syntax — Ansible Documentation](https://docs.ansible.com/ansible/latest/reference_appendices/YAMLSyntax.html)

### Block Style

先ほどのFlow Styleが複数行にまたがる構造を１行にまとめられるものであるのに対して、Block Styleは基本的には１行で書かれるものを複数行に分けて書くことができるようになるというものです。

#### Block Scalar

`:`の後につけるインジケーターによって微妙に改行の扱いが異なります。

-   `|`の場合  
    改行をそのまま取り扱います。

```yaml
sample: |
  a
  b
```

debugモジュールで参照した結果

```bash
ok: [localhost] => {
    "sample": "a\nb\n"
}
```

-   `>`の場合  
    文中の改行は折りたたまれてスペースになります。

```yaml
sample: >
  a
  b
```

debugモジュールで参照した結果

```bash
ok: [localhost] => {
    "sample": "a b\n"
}
```

#### Block Folding

ただし改行が折りたたまれるパターンは行頭が文字で始まるときの直前の改行となるので、改行を２つ空けたり、スペースで始まる行については`>`を使った場合でも改行が入ります。

```yaml
sample1: >
  a

  b
# "a\nb"

sample2: >
  a
   b
# "a\n b"
```

ansible実行結果

プレイブック

```yaml
---
- hosts: localhost
  gather_facts: false

  vars: 
    sample1: >
      a

      b

    sample2: >
      a
       b
  tasks:
    - debug:
        var: sample1
    - debug:
        var: sample2
```

実行結果

```
PLAY [localhost] ********************************************************************************************************************************************************************************************************

TASK [debug] ************************************************************************************************************************************************************************************************************
ok: [localhost] => {
    "sample1": "a\nb\n"
}

TASK [debug] ************************************************************************************************************************************************************************************************************
ok: [localhost] => {
    "sample2": "a\n b\n"
}

PLAY RECAP **************************************************************************************************************************************************************************************************************
localhost                  : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0  
```  

#### Explicit Block Mapping Entries

先ほどのBlock Scalarのように複数行で一つとなる定義をキーバリューの構造でも行うことができます。 `?`をインジケーターとして用いるとキーとバリューの間に改行があってもインデントがあっていれば正しく認識することができます。

```yaml
simple: ? a:
          b
# { "a": "b" }

complex: ? a:
          ? b:
            [1, 2, 3]
# { "a":  { "b": [1, 2, 3] } }
```

ansible実行結果 プレイブック

```yaml
---
- hosts: localhost
  gather_facts: false
  vars:
    simple:
      ? a
      : b
    complex:
      ? a
      : ? b
        : [1, 2, 3]
  
  tasks:
    - debug:
        var: simple
    - debug:
        var: complex
```

実行結果

```
PLAY [localhost] ************************************************************************************************************************************************

TASK [debug] ****************************************************************************************************************************************************
ok: [localhost] => {
    "simple": {
        "a": "b"
    }
}

TASK [debug] ****************************************************************************************************************************************************
ok: [localhost] => {
    "complex": {
        "a": {
            "b": [
                1,
                2,
                3
            ]
        }
    }
}

PLAY RECAP ******************************************************************************************************************************************************
localhost                  : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

### Tag Prefix

yamlでは変数の型を宣言せずとも自動的に解釈し、型をつけてくれます。

```yaml
first: 1 # => 整数型
point: 0.2 # => 浮動小数点型
gather_facts: yes # => bool型
name: do something # => 文字列型
```

ここでTag Prefixを使うと明示的な型付けができます。

```yaml
string_yes: !!str yes # => 明示的に文字列型になる
type_float:  !!float 1.2 # => 明示的に浮動小数点型になる
```

Tag Prefixを使う際には`!!`の後に型名を入れることで明示的な指定を行うことができます。 YAMLではTagはRFC4151のTag URIスキーマを参照する形になっています。 デフォルトで`!!`には`tag:yaml.org,2002:`が当たっているので`!!str`や`!!int`はtag:yaml.org,2002:str`・`tag:yaml.org,2002:int`を参照しています。 またTagは`!\`の形で参照することもできる他、Tagディレクティブで宣言することもできます。なので下記の形でもTagを使うことができます。  
詳しくは公式を参照してください⇒ [YAML Ain’t Markup Language (YAML™) revision 1.2.2](https://yaml.org/spec/1.2.2/#682-tag-directives)

```yaml
%TAG !e! tag:yaml.org,2002:
---
foo: !<tag:yaml.org,2002:str> bar
hoge: !e! map { piyo: 1}
```

ansible 実行結果 プレイブック

```yaml
%TAG !e! tag:yaml.org,2002:
---
- hosts: localhost
  gather_facts: no
  vars:
    not_tag:
      - 12345
      - 1.0
      - 1
    not_tag_date: 2022-01-01
    tag_var: 
      - !!str 12345
      - !!float 1.0
      - !<tag:yaml.org,2002:str> 1 
      - !e!str 2022-01-01

  tasks:
    - name: not tag
      block:
        - debug:
            msg: "{{ item | type_debug }}"
          loop: "{{ not_tag }}"

        - debug:
            msg: "{{ not_tag_date | type_debug }}"

    - name: debug vars with tag
      debug:
        msg: "{{ item | type_debug }}"
      loop: "{{ tag_var }}"
```

実行結果

```
PLAY [localhost] *******************************************************************************************************************************************

TASK [debug] ***********************************************************************************************************************************************
ok: [localhost] => (item=12345) => {
    "msg": "int"
}
ok: [localhost] => (item=1.0) => {
    "msg": "float"
}
ok: [localhost] => (item=1) => {
    "msg": "int"
}

TASK [debug] ***********************************************************************************************************************************************
ok: [localhost] => {
    "msg": "date"
}

TASK [debug vars with tag] *********************************************************************************************************************************
ok: [localhost] => (item=12345) => {
    "msg": "str"
}
ok: [localhost] => (item=1.0) => {
    "msg": "float"
}
ok: [localhost] => (item=1) => {
    "msg": "str"
}
ok: [localhost] => (item=2022-01-01) => {
    "msg": "str"
}

PLAY RECAP *************************************************************************************************************************************************
localhost                  : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```   

### Anchor Alias

`&`と`*`を使って値の再利用ができます。 下記の通りほとんど変数のように使用が可能です。

```yaml
foo: &test bar
hoge: *test # => 値は"bar"となる
```

Anchorはスカラ値だけでなくキーバリューや配列でも使用可能です。 このAnchorはYAMLが持つ機能なのでAnsibleでは変数として取り扱えないようなものも再利用できます。

```yaml
---
- hosts: localhost
  gather_facts: false

  vars:
    sample: &default happy
    feeling: *default

  tasks:
    - &debug_task
      name: debug sample
      debug:
        var: sample

    - name: debug feeling
      debug:
        var: feeling
    
    - *debug_task
```

上記のプレイブックを実行すると`debug sample`のタスクが`*debug_task`の箇所で実行されます。

```
PLAY [localhost] ********************************************************************************************************************************************************************************

TASK [debug sample] *****************************************************************************************************************************************************************************
ok: [localhost] => {
    "sample": "happy"
}

TASK [debug feeling] ****************************************************************************************************************************************************************************
ok: [localhost] => {
    "feeling": "happy"
}

TASK [debug sample] *****************************************************************************************************************************************************************************
ok: [localhost] => {
    "sample": "happy"
}

PLAY RECAP **************************************************************************************************************************************************************************************
localhost                  : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0  
```

またキーバリューと配列のAnchoraは`<<:`で展開もできます。 これで展開すると、キーバリューの場合は値の上書きができます。 感覚的にはJavaScriptでスプレッド構文を使ったオブジェクトのプロパティ上書きに近いですね。

```yaml
- &debug_task
  name: debug sample
  debug:
    var: sample

- <<: *debug_task
  name: debug sample2
# nameの値を入れ替え（下記の構造になる）
# - name: debug sample2
#   debug:
#     var: sample
```

Ansible 実行結果 プレイブック

```yaml
---
- hosts: localhost
  gather_facts: false
  vars:
    sample: hello!

  tasks:
    - &debug_task
      name: debug sample
      debug:
        var: sample

    - <<: *debug_task
      name: debug sample2
```

実行結果

```yaml
PLAY [localhost] ************************************************************************************************************************************************

TASK [debug sample] *********************************************************************************************************************************************
ok: [localhost] => {
    "sample": "hello!"
}

TASK [debug sample2] ********************************************************************************************************************************************
ok: [localhost] => {
    "sample": "hello!"
}

PLAY RECAP ******************************************************************************************************************************************************
localhost                  : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0  
```  

docker\_compose.ymlですがNetBoxのdocker\_compose.ymlはAnchorがいい感じに使われているので一見の価値あるかと、、、

Anchor、AliasはYAMLの形式を活かした形だと思うので今後のPlaybook開発に活用することが出来ればよいかなと思いました。 それ以外はあまり使いどころとしては微妙かも、、、

参考

[YAML Ain’t Markup Language (YAML™) revision 1.2.2](https://yaml.org/spec/1.2.2/)

[YAML の記述 - CircleCI](https://circleci.com/docs/ja/2.0/writing-yaml/)

[YAMLのAnchorとAliasをAnsibleで使う - 赤帽エンジニアブログ](https://rheb.hatenablog.com/entry/2019/12/08/YAML%E3%81%AEAnchor%E3%81%A8Alias%E3%82%92Ansible%E3%81%A7%E4%BD%BF%E3%81%86)

[netbox-docker/docker-compose.yml at release · netbox-community/netbox-docker · GitHub](https://github.com/netbox-community/netbox-docker/blob/release/docker-compose.yml)
