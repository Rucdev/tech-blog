---
title: "【Ansible】NEC IX向けのコレクションをAnsible Galaxyにアップしました。"
date: 2023-02-19T01:11:38+09:00
categories: ["Ansible"]
draft: false
hatenaPath: "/entry/2023/02/19/011138"
---

### Ansible Galaxyへコレクションをアップする。

以前作成した、Ansibleコレクションをこの度Ansible Galaxyにアップしました。 URLはこちら

[https://galaxy.ansible.com/rucdev/ix](https://galaxy.ansible.com/rucdev/ix)

気になる方は是非お試しください。

## 現在のコレクションが抱える課題

ということでAnsible Galaxyにコレクションをアップしてみたのですが、このコレクション結構課題山積みなのです。 その課題を今わかっているものだけでもアップしておきます。 使ってみたい人向けの諸注意といいつつ、自分のための備忘録です。

#### 課題

-   NEC IX 2105のみでしか動作検証をしていない  
    作成者の財力のNASA🚀
-   IXのバージョンは10.2.39のみでしか動作検証をしていない  
    作成者がフリーメールのアドレスしか持っていないため[NetMeister](https://www.necplatforms.co.jp/product/netmeister/outline.html#anc-howto)に登録してOSのバージョンを上げるが出来ませんでした。
-   他のユーザーがグローバルコンフィグモードに入っていると接続に失敗する  
    これはグローバルコンフィグモードへの移行を`configure`で行っているためです。  
    この部分については`svintr-config`に切り替えるか、それらを選べるようにするのかを決めかねて結局何もしていない状況です。
-   ドキュメントが未整備  
    ひとえに作成者の怠惰です。  
    英語難しい...
-   まだモジュールが`ix_command`と`ix_config`しかない  
    今後色々作る予定です...

とまあ自分で思いつくだけでこのくらいあるので、もし使う方がいましたらこのあたりを把握していただけますと幸いです。
