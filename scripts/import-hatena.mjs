#!/usr/bin/env node
/**
 * はてなブログのエクスポート(Movable Type形式)を posts/<slug>/index.md に変換する。
 *
 *   node scripts/import-hatena.mjs <export.txt>
 *
 * - 本文HTML → Markdown (turndown)
 * - はてなフォトライフの画像は posts/<slug>/images/ にダウンロードして相対参照に書き換え
 * - はてなキーワードの自動リンクはプレーンテキスト化
 * - 埋め込みカード(iframe)・ツイート埋め込みは通常のリンクに変換
 * - 旧URLは frontmatter の hatenaPath に保持(リダイレクト用)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(repoRoot, "posts");

// BASENAME → スラグ(=ディレクトリ名=URLになる想定)。新規記事を再取込する場合はここに追記する。
const slugMap = {
  "2026/06/27/011828": "switch-main-pc-to-fedora",
  "2026/04/13/002819": "clabernetes-on-k3s",
  "2026/02/21/135050": "netbox-customscript-proxmox-vm",
  "2025/12/07/131329": "ansible-navigator",
  "2025/10/05/235320": "nec-ix-collection-update",
  "2025/07/21/083000": "gemini-cli-tmux-coding",
  "2024/10/10/224317": "terraform-serverless-app",
  "2024/06/02/200818": "awx-vault-pitfalls",
  "2024/03/03/021841": "terraform-on-aws-cloudshell",
  "2023/12/11/083000": "ansible-network-resource-module-idempotency",
  "2023/11/13/004816": "ansible-action-plugin",
  "2023/08/24/222151": "getting-started-with-pulumi",
  "2023/07/20/090000": "terraform-to-ansible",
  "2023/05/24/000957": "ansible-networkconfig",
  "2023/03/20/005617": "reading-netconfig-ansible",
  "2023/02/19/011138": "nec-ix-collection-on-galaxy",
  "2022/12/20/121802": "juniper-vlabs-ansible-bgp-multi-as",
  "2022/12/09/090000": "creating-nec-ix-ansible-collection",
  "2022/12/06/090000": "first-ansible-module",
  "2022/07/08/002943": "juniper-vlabs-mpls",
  "2022/06/24/093000": "dynamic-input-fields-react-typescript",
  "2022/05/13/224821": "understanding-ansible-playbook-via-yaml-2",
  "2022/04/27/230651": "understanding-ansible-playbook-via-yaml",
  "2022/03/05/144004": "getting-started-with-rocker",
  "2022/03/05/004804": "cool-shell-prompt",
  "2022/02/08/083000": "javascript-in-the-browser",
};

const langMap = {
  "lang-yaml": "yaml", yml: "yaml", "lang-hcl": "hcl", "lang-html": "html",
  "lang-markdown": "markdown", "lang-python": "python", "lang-r": "r",
  "lang-sh": "sh", "lang-terraform": "terraform", "lang-typescript": "typescript",
  plaintext: "", pre: "", code: "",
};

// ---- Movable Type形式のパース ----
function parseExport(text) {
  const entries = [];
  for (const raw of text.split(/^--------\r?\n/m)) {
    if (!raw.trim()) continue;
    const chunks = raw.split(/^-----\r?\n/m);
    const headers = {};
    const categories = [];
    for (const line of chunks[0].split(/\r?\n/)) {
      const m = line.match(/^([A-Z ]+):\s?(.*)$/);
      if (!m) continue;
      if (m[1] === "CATEGORY") categories.push(m[2]);
      else headers[m[1]] = m[2];
    }
    const sections = {};
    for (const chunk of chunks.slice(1)) {
      const m = chunk.match(/^([A-Z ]+):\r?\n?([\s\S]*)$/);
      if (m) sections[m[1]] = m[2].trim();
    }
    if (headers.TITLE) entries.push({ headers, categories, sections });
  }
  return entries;
}

// ---- HTML → Markdown ----
function makeTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });
  td.remove("script");
  td.remove("style");

  // はてなのコードブロック。中のシンタックスハイライト用spanはtextContentで剥がす
  td.addRule("hatenaPre", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const rawLang = node.getAttribute("data-lang") || "";
      const lang = langMap[rawLang] ?? rawLang;
      const code = node.textContent.replace(/\n+$/, "");
      const fence = code.includes("```") ? "````" : "```";
      return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
    },
  });

  // 図(キャプション付き画像)
  td.addRule("hatenaFigure", {
    filter: (node) =>
      node.nodeName === "FIGURE" && /figure-image/.test(node.className || ""),
    replacement: (_content, node) => {
      const img = node.querySelector("img");
      if (!img) return "";
      const caption = node.querySelector("figcaption")?.textContent?.trim() ?? "";
      return `\n\n![${caption}](${img.getAttribute("src")})\n\n`;
    },
  });

  // はてなキーワードの自動リンクはただのテキストに戻す
  td.addRule("hatenaKeyword", {
    filter: (node) =>
      node.nodeName === "A" && /keyword/.test(node.className || ""),
    replacement: (content) => content,
  });

  // 埋め込みカード(iframe)は通常のリンクへ
  td.addRule("embedCard", {
    filter: (node) =>
      node.nodeName === "IFRAME" && /embed-card/.test(node.className || ""),
    replacement: (_content, node) => {
      const src = node.getAttribute("src") || "";
      const m = src.match(/[?&]url=([^&]+)/);
      const url = m ? decodeURIComponent(m[1]) : src;
      const title = node.getAttribute("title") || url;
      return `\n\n[${title}](${url})\n\n`;
    },
  });

  // ツイート埋め込みはステータスへのリンクへ
  td.addRule("tweet", {
    filter: (node) =>
      node.nodeName === "BLOCKQUOTE" && /twitter-tweet/.test(node.className || ""),
    replacement: (_content, node) => {
      const links = Array.from(node.querySelectorAll("a"));
      const status = links.find((a) => /\/status\//.test(a.getAttribute("href") || ""));
      const href = status?.getAttribute("href")?.replace(/\?.*$/, "");
      const label = node.textContent.trim().split("\n")[0].slice(0, 60);
      return href ? `\n\n[ツイート: ${label}…](${href})\n\n` : "";
    },
  });

  return td;
}

// Markdownの後処理:
// - 見出しを1段階降格(記事タイトルがh1になる想定なので本文はh2から)
// - コード外に残った <placeholder> をエスケープ(生HTML扱いで消えるのを防ぐ)
function postprocess(md) {
  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/^#{1,5} /.test(line)) line = "#" + line;
      return line
        .split(/(`[^`]*`)/)
        .map((seg, i) => (i % 2 ? seg : seg.replace(/<([^\s<>`]+)>/g, "\\<$1>")))
        .join("");
    })
    .join("\n");
}

// ---- 画像ダウンロード ----
const FOTOLIFE = /https?:\/\/cdn-ak\.f\.st-hatena\.com\/images\/fotolife\/[^\s"'<>)]+/g;

async function download(url, dest) {
  if (fs.existsSync(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// ---- メイン ----
const exportFile = process.argv[2];
if (!exportFile) {
  console.error("usage: node scripts/import-hatena.mjs <export.txt>");
  process.exit(1);
}

const entries = parseExport(fs.readFileSync(exportFile, "utf8"));
const td = makeTurndown();
let failures = 0;

for (const entry of entries) {
  const { headers, categories, sections } = entry;
  const basename = headers.BASENAME;
  const slug = slugMap[basename];
  if (!slug) {
    console.warn(`SKIP (slugMapに未登録): ${basename} ${headers.TITLE}`);
    failures++;
    continue;
  }

  const postDir = path.join(postsDir, slug);
  const imagesDir = path.join(postDir, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  let html = sections.BODY ?? "";
  if (sections["EXTENDED BODY"]) html += "\n" + sections["EXTENDED BODY"];

  // 画像: ダウンロードして相対パスへ書き換え
  const urls = new Set(html.match(FOTOLIFE) ?? []);
  if (headers.IMAGE) for (const u of headers.IMAGE.match(FOTOLIFE) ?? []) urls.add(u);
  const localName = {};
  for (const url of urls) {
    const name = path.basename(new URL(url).pathname);
    localName[url] = name;
    try {
      await download(url, path.join(imagesDir, name));
    } catch (e) {
      console.warn(`  画像取得失敗: ${e.message}`);
      failures++;
      delete localName[url];
    }
  }
  html = html.replace(FOTOLIFE, (u) => (localName[u] ? `./images/${localName[u]}` : u));

  let md = postprocess(td.turndown(html).replace(/\n{3,}/g, "\n\n").trim());

  // DATE: MM/DD/YYYY HH:MM:SS (JST)
  const dm = headers.DATE.match(/(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d:\d\d)/);
  const date = `${dm[3]}-${dm[1]}-${dm[2]}T${dm[4]}+09:00`;

  const fm = [
    "---",
    `title: ${JSON.stringify(headers.TITLE)}`,
    `date: ${date}`,
    `categories: [${categories.map((c) => JSON.stringify(c)).join(", ")}]`,
    `draft: ${headers.STATUS !== "Publish"}`,
    `hatenaPath: ${JSON.stringify("/entry/" + basename)}`,
  ];
  if (sections.EXCERPT) fm.push(`description: ${JSON.stringify(sections.EXCERPT)}`);
  const headerImage = headers.IMAGE && localName[headers.IMAGE];
  if (headerImage) fm.push(`image: ./images/${headerImage}`);
  fm.push("---");

  fs.writeFileSync(path.join(postDir, "index.md"), fm.join("\n") + "\n\n" + md + "\n");
  console.log(`OK: ${slug}${headers.STATUS !== "Publish" ? " (draft)" : ""}`);
}

console.log(failures ? `完了(警告 ${failures}件)` : "完了");
