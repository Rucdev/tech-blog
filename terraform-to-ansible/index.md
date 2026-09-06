---
title: "Terraform ↔ Ansible"
date: 2023-07-20T09:00:00+09:00
categories: ["Ansible", "Terraform"]
draft: false
hatenaPath: "/entry/2023/07/20/090000"
description: "Ansible ↔ Terraformの橋渡しについて"
---

-   [TerraformとAnsible](#TerraformとAnsible)
    -   [Terraform → Ansible](#Terraform--Ansible)
        -   [local\_fileリソースでinventory.iniファイルを作成してlocal-execで実行](#local_fileリソースでinventoryiniファイルを作成してlocal-execで実行)
        -   [ansible/ansibleのproviderを利用する](#ansibleansibleのproviderを利用する)
    -   [Ansible → Terraform](#Ansible--Terraform)
        -   [ansible.builtin.shellモジュールでコマンドから実行](#ansiblebuiltinshellモジュールでコマンドから実行)
        -   [cloud.terraformコレクションを利用する](#cloudterraformコレクションを利用する)
    -   [参考](#参考)
    -   [...](#)

## TerraformとAnsible

TerraformとAnsible、どちらもIaCツールでありインフラ構築の自動化を行うことができます。

TerraformとAnsible、この両者はどちらも一方から他方を呼ぶことができます。  
ということでTerraform → AnsibleとAnsible → Terraformで両方のパターンの橋渡しの部分についてを書いていきます。

### Terraform → Ansible

Terraformが主体となりAnsible Playbookを実行するやり方で大きくは2つのパターンがあるのでそれぞれ紹介します。

-   `local_file`リソースで`inventory.ini`ファイルを作成して`local-exec`で実行
-   `ansible/ansible`の`provider`を利用する方法

#### `local_file`リソースで`inventory.ini`ファイルを作成して`local-exec`で実行

Terraformの`local_file`リソースを利用し、Ansibleで利用するための`inventory.ini`を作成し、`local-exec`で`ansible-playbook`コマンドを実行する方法です。

Ansibleで使用する`inventory`ファイルは`templatefile`メソッドで作成します。  
Jinja2っぽいテンプレートファイル（微妙にJinja2とは違う）を利用してあとは利用している変数のマッピングを`templatefile`メソッドの引数で指定すればOKです。

`local_file.tf`

```terraform
resource "local_file" "inventory" {
  depends_on = [aws_instance.myServer]
  content = templatefile("./inventory.tftpl",
    {
      server = aws_instance.myServer
    }
  )
  filename = "./inventory.ini"
}
```

`inventory.tftpl`

```
[server]
${server.tags.Name} ansible_host=${server.public_ip}

[server:vars]
ansible_user="ec2-user"

[all:vars]
ansible_ssh_private_key_file="./private_key.pem"
```

これで`inventory.ini`のファイルが生成されるのでそれを利用して`ansible-playbook`コマンドを実行します。

Ansibleを実行するための`.tf`ファイルは下記になります。

`ansible.tf`

```terraform
resource "null_resource" "provisioning" {
  depends_on = [local_file.inventory]
  provisioner "remote-exec" {
    connection {
      host        = aws_instance.myServer.public_ip
      user        = "ec2-user"
      private_key = file("./ssh_key.pem")
    }
    inline = [ "echo 'ready to do ansible!'" ]
  }
  provisioner "local-exec" {
    command = "ansible-playbook -i inventory.ini setup_server.yaml"
  }

}
```

この時、対象のEC2が起動してくるのを待つために`remote-exec`でのコマンド実行を挟んでおくのがポイントです。  
これがないと起動しきっていないインスタンスにPlaybookを実行してしまいます。

#### `ansible/ansible`の`provider`を利用する

[`ansible/ansible`プロバイダー](https://registry.terraform.io/providers/ansible/ansible/latest)が公式より提供されています。 [https://registry.terraform.io/providers/ansible/ansible/latest](https://registry.terraform.io/providers/ansible/ansible/latest)

この`ansible/ansible`プロバイダーでは`ansible_playbook`の`resource`で`ansible-playbook`コマンドを実行することができます。

また、`ansible_host`リソースを使用すると、Ansibleの`cloud.terraform.terraform_plugin`で参照するためのインベントリ情報を作成することもできます。  
これは後述のAnsible → Terraformにて使用します。

話を戻してTerraform → Ansibleについて。  
この`ansible_playbook`の`resource`ですが、少々癖があり、リソースの設定ではinventoryファイルの指定ができない他、プロバイダーに同梱の`ansible_host`を全く参照してくれません。  
そのため、リソースの`name`か、`extra_vars`の部分で`ansible_host`や`ansible_user`を渡してあげる必要があります。

[GitHubのIssue](https://github.com/ansible/terraform-provider-ansible/issues/37)では外部変数で`inventory_file`を指定すると良いというような記述がありますが、`inventory_file`はマジック変数でAnsibleの公式ドキュメントではマジック変数はユーザー側から指定できないとあるので、この解決方法はちょっと眉唾です。（ちなみに私はこれでは解決しませんでした。Issueにもそれでうまくいかなかった人のコメントがあります。）

`ansible.tf`

```terraform
resource "ansible_playbook" "setup_server" {
  playbook   = "./setup_server.yaml"
  name       = "myServer"
  replayable              = false
  ignore_playbook_failure = true # ここをtrueにしないとproviderが呼べませんでした
  extra_vars = {
    ansible_host                 = aws_instance.myServer.public_ip
    ansible_user                 = "ec2-user"
    ansible_ssh_private_key_file = "./ssh_key.pem"
  }
}

output "playbook_stdout" {
  value = ansible_playbook.setup_server.ansible_playbook_stdout
}
```

`output`で`ansible_playbook_stdout`を指定してあげるとAnsibleの実行結果を`output`として返してくれます。

ただ、ここでもEC2インスタンスが作成される前にAnsible Playbookが実行されてしまう問題があったので、最終的に下記の形になりました。

`ansible.tf`

```terraform
resource "null_resource" "wait_instance" {
  depends_on = [aws_instance.myServer]
  provisioner "remote-exec" {
    connection {
      host        = aws_instance.myServer.public_ip
      user        = "ec2-user"
      private_key = file("./ssh_key.pem")
    }
    inline = ["echo 'ready to do ansible!'"]
  }
}

resource "ansible_playbook" "setup_server" {
  depends_on              = [null_resource.wait_instance]
  playbook                = "./setup_server.yaml"
  name                    = "myServer"
  replayable              = false
  ignore_playbook_failure = true
  extra_vars = {
    ansible_host                 = aws_instance.myServer.public_ip
    ansible_user                 = "ec2-user"
    ansible_ssh_private_key_file = "./ssh_key.pem"
  }
}
output "playbook_stdout" {
  value = ansible_playbook.setup_server.ansible_playbook_stdout
}
output "playbook_stderr" {
  value = ansible_playbook.setup_server.ansible_playbook_stderr
}
```

`null_resource`の`wait_instance`で対象のインスタンスへ`remote-exec`をし、それを`ansible_playbook`から`depends_on`で依存関係に設定することでインスタンスの立ち上がりを完全に待つことができました。

### Ansible → Terraform

AnsibleからTerraformを呼ぶ方法は大きく下記の２つがあります。

-   `ansible.builtin.shell`モジュールでコマンドから実行する方法
-   `cloud.terraform`コレクションを利用する方法

#### `ansible.builtin.shell`モジュールでコマンドから実行

`terraform init`と`terraform apply`を`ansible.builtin.shell`モジュールで実行します。

インベントリについてはプラットフォームの`inventory plugin`を用いてみます。  
後述の`cloud.terraform.terraform_plugin`をつかっても良いのですが、差別化のためにここはあえて。

```yaml
---
plugin: amazon.aws.aws_ec2
regions:
  - ap-northeast-1
filters:
  instance-state-name: running
keyed_groups:
  - key: tags.Name
hostnames:
  - ip-address
```

`inventory plugin`を使う場合は`ansible.cfg`で有効化が必要です。

`ansible.cfg`

```
[inventory]
enable_pluginsf = amazon.aws.aws_ec2
```

これでPlaybook側で呼び出せばOKです。

```yaml
---
# AnsibleからTerraformを呼ぶ
- name: Provisioning
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Call Terraform
      ansible.builtin.shell:
        cmd: terraform init && terraform apply -auto-approve

# Terraformで立ち上げたEC2に設定を行う
- name: Setting
  hosts: myServer
  gather_facts: true
  become: true
  tasks:
    - name: Install package
      ansible.builtin.yum:
        name:
          - httpd
...
```

#### `cloud.terraform`コレクションを利用する

`cloud.terraform`コレクションの`cloud.terraform.terraform`モジュールでTerraformのプロジェクトを呼び出します。  
Ansibleによる設定投入を実行する際に必要となるインベントリについては`ansible/ansible`の`provider`と`cloud.terraform.terraform_plugin`を今回は使います。

`inventory plugin`を使う場合はTerraformとAnsibleのそれぞれでファイルに手を入れる必要があります。

Terraform側では、`ansible_group`または`ansible_host`の`resource`を作成します。

`inventory.tf`

```terraform
resource "ansible_host" "myServer" {
  depends_on = [aws_instance.myServer]
  name       = aws_instance.myServer.tags.Name
  groups     = ["server"]
  variables = {
    ansible_host                 = aws_instance.myServer.public_ip
    ansible_user                 = "ec2-user"
    ansible_ssh_private_key_file = "ssh_key.pem"
  }
}
```

Ansible側では`cloud.terraform.terraform_plugin`を利用する`inventory`ファイルを作成します。

`inventory.yaml`

```yaml
---
plugin: cloud.terraform.terraform_provider
```

`ansible.cfg`ファイルに`cloud.terraform.terraform_provider`を有効化する設定を記述します。

```ini
[inventory]
enable_plugin = ini, cloud.terraform.terraform_provider
```

これでTerraformで作成したインスタンスをAnsibleのインベントリにつなげることができました。

`call_terraform.yaml`

```yaml
---
# AnsibleからTerraformを呼ぶ
- name: Provisioning
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Call Terraform
      cloud.terraform.terraform:
        project_path: terraform/
        state: present
        force_init: true

# Terraformで立ち上げたEC2に設定を行う
- name: Setting
  hosts: myServer
  gather_facts: true
  become: true
  tasks:
    - name: Install package
      ansible.builtin.yum:
        name:
          - httpd
...
```

この`cloud.terraform.terraform`のドキュメントは[こちら](https://github.com/ansible-collections/cloud.terraform/blob/main/docs/cloud.terraform.terraform_module.rst)  
[`community.general.terraform`](https://docs.ansible.com/ansible/latest/collections/community/general/terraform_module.html)でもほとんど同じことができます。

ほとんど差がないですが、`inventory plugin`がある分`cloud.terraform`の方がお得な気がします。

### 参考

[GitHub - ansible/terraform-provider-ansible: community terraform provider for ansible](https://github.com/ansible/terraform-provider-ansible) [Inventory plugins — Ansible Community Documentation](https://docs.ansible.com/ansible/latest/plugins/inventory.html) [templatefile - Functions - Configuration Language | Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/language/functions/templatefile) [Ansible vs. Terraform, clarified](https://www.redhat.com/en/topics/automation/ansible-vs-terraform) [Providing Terraform with that Ansible Magic | Ansible Collaborative](https://www.ansible.com/blog/providing-terraform-with-that-ansible-magic)

### ...

Ansible → Terraformの方が順序性がわかりやすくて個人的に好き。 `ansible/ansible`の`ansible_playbook`のリソースが使い勝手悪いせいもあるので、今後アップデートがかかることに期待。
