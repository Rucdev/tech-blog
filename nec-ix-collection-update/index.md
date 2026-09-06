---
title: "Ansible NEC IXコレクションを2年越しにアップデートしました。"
date: 2025-10-05T23:53:20+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2025/10/05/235320"
---

## NEC IXルーター向けコレクションにOSPFとStatic RouteのNetwork Resource Moduleを追加しました！

[Ansible Galaxy](https://galaxy.ansible.com/ui/repo/published/rucdev/ix/)

[galaxy.ansible.com](https://galaxy.ansible.com/ui/repo/published/rucdev/ix/)

今回のアップデートでは下記のモジュールの追加を行いました。

-   `rucdev.ix.ix_ospfv2`
-   `rucdev.ix.ix_ospfv3`
-   `rucdev.ix.ix_ospf_interfaces`
-   `rucdev.ix.ix_static_routes`

前回の更新は2023年2月なのでおよそ2年8か月振りの更新となります。 [前回の更新](https://ruc-4130.hatenablog.com/archive/2023)

### OSPFモジュールを使ってみる

ここでは私の担当分であるOSPF周りについて少し触れます。

今回のアップデートで追加したモジュールはすべて[cisco.ios](https://docs.ansible.com/ansible/latest/collections/cisco/ios/index.html)コレクションを参考にしています。  
なので基本的には、Ciscoモジュールの書き方と合わせる形で作成しています。

簡単なOSPFの設定例

```yaml
---
- name: Ix ospf setting
  hosts: ix
  gather_facts: false
  tasks:
    - name: OSPF setting
      rucdev.ix.ix_ospfv2:
        config:
          processes:
            - process_id: 1
              areas:
                - area_id: 0
              network:
                - address: 192.0.2.128/25
                  area: 0
```

今回は以前よりもドキュメント周りを頑張ったので詳しくはAnsible GalaxyのDocsを見てください！

[Ansible Galaxy](https://galaxy.ansible.com/ui/repo/published/rucdev/ix/docs/)

[galaxy.ansible.com](https://galaxy.ansible.com/ui/repo/published/rucdev/ix/docs/)

### Network Resource Moduleへの挑戦

今回のモジュール追加開発ではAnsibleのNetwork Resource Moduleの形での開発に挑戦しました。

[Network Resource Modules](https://docs.ansible.com/ansible/latest/network/user_guide/network_resource_modules.html)

[Developing network resource modules](https://docs.ansible.com/ansible/latest/network/dev_guide/developing_resource_modules_network.html)

AnsibleのNetwork Resource Moduleには開発するためのボイラープレートを作成してくれる[Resource module builder](https://github.com/ansible-network/resource_module_builder)というツールがあり、 基本的にこれを利用して開発を進めていきます。

しかし、道は険しくNetwork Resource Moduleそのものの理解やネットワークOS固有のパラメータやバリデーションを吸収するためにはかなり詳しいネットワークOSへの理解が必要となり、ここにかなりの時間を割くことになりました。

色々あって2年ほどの時間を要することとなりましたが、それでも他のNetwork Resource Moduleのレベルにも達することができなかったので世のNetwork Resource Moduleの開発者には頭が上がりません。

## まとめ

かなり久々の更新となってしまいましたが、AnsibleのNEC IX向けコレクションを更新しました！ 皆様、使ってみてください。至らぬ点は多いかと思いますがフィードバックを雑多に投げてください（投げ先⇒[https://github.com/Rucdev/ix\_ansible/issues](https://github.com/Rucdev/ix_ansible/issues)）

そして一緒に開発を手伝ってくれた [nakayumc0278 (nakayumc) · GitHub](https://github.com/nakayumc0278) に感謝を  
本当にありがとう！！
