# tech-blog

ブログ記事のコンテンツリポジトリ。はてなブログ (ruc-4130.hatenablog.com) からエクスポートした記事をMarkdown化したもの + 新規記事を管理する。

ビルドは行わない。Astroで作成した別リポジトリからこのリポジトリを参照(git submodule推奨)してSSGビルドする。

## 構成

```
posts/
  <slug>/            # slugがそのまま記事のIDになる想定
    index.md         # frontmatter + 本文Markdown
    images/          # この記事専用の画像(本文からは ./images/xxx.png で相対参照)
scripts/
  import-hatena.mjs  # はてなエクスポート(MT形式) → posts/ 変換スクリプト
```

- 画像は記事ディレクトリに同梱(コロケーション)。はてなCDN上の画像はすべてダウンロード済みで、外部依存はない。
- 本文の見出しはh2(`##`)から始まる。h1は記事タイトル(frontmatterの`title`)をレイアウト側で出す想定。

## frontmatter

```yaml
---
title: "記事タイトル"
date: 2026-06-27T01:18:28+09:00
categories: ["Ansible"]
draft: false                        # trueは下書き。本番ビルドでは除外する
hatenaPath: "/entry/2026/06/27/011828"  # 旧はてなURLのパス(リダイレクト設定用)
description: "概要"                  # 任意
image: ./images/xxx.png             # 任意。OGP/アイキャッチ用(記事ディレクトリからの相対パス)
---
```

## Astro側からの参照方法

Astro 5のContent Layer(globローダー)で読み込む。`src/content/`配下に置く必要はない。

1. Astroリポジトリにsubmoduleとして追加:

```sh
git submodule add https://github.com/Rucdev/tech-blog content/tech-blog
git submodule update --init
```

2. `src/content.config.ts`:

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({
    pattern: "*/index.md",
    base: "./content/tech-blog/posts",
    // IDを "switch-main-pc-to-fedora" のようにディレクトリ名だけにする
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ""),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      categories: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      hatenaPath: z.string().optional(),
      description: z.string().optional(),
      image: image().optional(),
    }),
});

export const collections = { blog };
```

3. ページ生成(例: `src/pages/blog/[...id].astro`):

```ts
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection(
    "blog",
    ({ data }) => !(import.meta.env.PROD && data.draft) // 本番では下書きを除外
  );
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}
```

- 本文中の相対画像(`./images/xxx.png`)もfrontmatterの`image`も、Astroが`astro:assets`で自動的に最適化・ハッシュ付きパス化する。追加設定は不要。
- 旧はてなURLからのリダイレクトが必要なら、`hatenaPath`を使って`astro.config.mjs`の`redirects`やホスティング側のリダイレクト設定を生成できる。

記事を更新したらAstro側で `git submodule update --remote` して再ビルドする(CIならcheckout時に`submodules: true`)。

## 新規記事の追加

`posts/<slug>/index.md` を上記frontmatterで作成し、画像は `posts/<slug>/images/` に置くだけ。

## はてなからの再取込

```sh
cd scripts && npm install
node import-hatena.mjs ~/Downloads/ruc-4130.hatenablog.com.export.txt
```

新しい記事を取り込む場合は `scripts/import-hatena.mjs` の `slugMap` にBASENAME→slugの対応を追記する。ダウンロード済み画像はスキップされる。
