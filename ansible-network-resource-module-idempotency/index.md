---
title: "AnsibleのNetwork Resource Moduleが冪等性の確認として利用しているコマンドを探る"
date: 2023-12-11T08:30:00+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2023/12/11/083000"
---

この記事は [エーピーコミュニケーションズ Advent Calendar](https://qiita.com/advent-calendar/2023/ap-com) 2023 の11日目の投稿です。

## Network Resoruce Moduleとは

公式はこちら ⇒　 [Network Resource Modules — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/network/user_guide/network_resource_modules.html)

端的に言うとネットワーク系のコレクションにおいて`~_command`や`~_config`ではない、`~_interface`や`~_ospf`などのより細かい単位での設定を行うモジュールのこと。

今回はその冪等性をいかに確認しているかについて`cisco.ios.ios_interfaces`モジュールをベースに探っていきます。

## 冪等性について

### 大体のconfigモジュール

Configの文字列のダイジェストを比較しています。

`cisco.ios.ios_config`モジュールより抜粋

```python
        running_config = NetworkConfig(indent=1, contents=output[0], ignore_lines=diff_ignore_lines)
        startup_config = NetworkConfig(indent=1, contents=output[1], ignore_lines=diff_ignore_lines)
        if running_config.sha1 != startup_config.sha1:
            save_config(module, result)
```

### Resource Module

Factを作ってそれを比較しています。

#### Fact

Ansibleは`gather_fact`を`true`にすると対象の機器情報を収集します。  
これはネットワーク機器を対象とした場合はそのネットワークOSに合わせたFactsが収集されます。

例えば下記のような形

```python
"GigabitEthernet1": {
        "bandwidth": 1000000, 
        "description": null, 
        "duplex": "Full", 
        "ipv4": {
            "address": "192.168.1.1", 
            "masklen": 24
        }, 
        "lineprotocol": "up ", 
        "macaddress": "", 
        "mediatype": "RJ45", 
        "mtu": 1500, 
        "operstatus": "up", 
        "type": "CSR vNIC"
    }, 
```

ConfigとPlaybookに記載された内容をこのFactの形に起こして、それらを対合することで冪等性を担保しています。

ではそのFactはどのように集めているのか、それは当然ですがResource Moduleごとに異なります。

`cisco.ios.ios_interfaces`の場合は`cisco.ios`の`plugins/module_utils/network/ios/facts/interfaces/interfaces.py`に答えがあります。

[plugins/module\_utils/network/ios/facts/interfaces/interfaces.py](https://github.com/ansible-collections/cisco.ios/blob/main/plugins/module_utils/network/ios/facts/interfaces/interfaces.py) から一部抜粋

```python
class InterfacesFacts(object):
    """The ios interfaces facts class"""

    def __init__(self, module):
        self._module = module
        self.argument_spec = InterfacesArgs.argument_spec

    def get_interfaces_data(self, connection):
        return connection.get("show running-config | section ^interface")

    def populate_facts(self, connection, ansible_facts, data=None):
        """Populate the facts for Interfaces network resource

        :param connection: the device connection
        :param ansible_facts: Facts dictionary
        :param data: previously collected conf

        :rtype: dictionary
        :returns: facts
        """
        if not data:
            data = self.get_interfaces_data(connection)
```

ここでは`get_interfaces_data`にて`show running-config | section ^interface`をコマンド実行していることがわかります。

## まとめ

ということで、`cisco.ios.ios_interfaces`では冪等性の確認として`show running-config | section ^interface`のコマンドを使用していることがわかりました。

その他のResource Moduleもだいたいは`module_utils/network/<network_os>/facts/<module_name>/<module_name>.py`のファイルに答えがあるので気になった方は是非ここを探るとよいでしょう。
