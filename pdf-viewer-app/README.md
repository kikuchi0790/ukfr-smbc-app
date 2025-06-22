# PDF & 和訳テキスト並列ビューア

PDFファイルとその和訳テキストを左右に並べて表示するWebアプリケーションです。

## 機能

- PDFと和訳テキストの並列表示
- ページ同期機能（スクロール同期ON/OFF可能）
- ページナビゲーション（前後移動、ページ番号直接入力）
- Chrome風のダークテーマUI
- レスポンシブデザイン

## 使い方

### 1. ローカルサーバーの起動

CORS制限を回避するため、ローカルサーバーを起動する必要があります。

```bash
# このフォルダに移動
cd pdf-viewer-app

# Pythonでサーバーを起動（ポート8888）
python3 -m http.server 8888
```

### 2. ブラウザでアクセス

```
http://localhost:8888/pdf_viewer.html
```

## ファイル構成

```
pdf-viewer-app/
├── pdf_viewer.html              # メインのHTMLファイル
├── UKFR_ED32_Checkpoint.pdf     # PDFファイル1
├── UKFR_ED32_Study_Companion.pdf # PDFファイル2
├── UKFR_ED32_Checkpoint_ja_fixed.txt     # 和訳テキスト1
├── UKFR_ED32_Study_Companion_ja_fixed.txt # 和訳テキスト2
└── README.md                    # このファイル
```

## カスタマイズ

### 独自のPDFファイルを使用する場合

1. PDFファイルをこのフォルダに配置
2. 対応する日本語テキストファイルを `ファイル名_ja_fixed.txt` として配置
3. `pdf_viewer.html` の以下の部分を編集：

```html
<select id="pdfSelector">
    <option value="あなたのPDF.pdf">あなたのPDF.pdf</option>
</select>
```

### テキストファイルの形式

テキストファイルは以下の形式に従ってください：

```
================================================================================
ページ 1

ページ1の内容...

================================================================================
ページ 2

ページ2の内容...
```

## 他のアプリへの組み込み

このフォルダ全体を移動して、上記の手順でローカルサーバーを起動するだけで使用できます。

### iframeでの埋め込み

```html
<iframe src="http://localhost:8888/pdf_viewer.html" width="100%" height="800px"></iframe>
```

## 技術仕様

- PDF.js 3.11.174を使用
- 純粋なHTML/CSS/JavaScriptで実装
- 外部依存関係はPDF.js（CDN）のみ

## トラブルシューティング

### PDFが表示されない場合
- ローカルサーバーが起動しているか確認
- ブラウザのコンソールでエラーを確認
- PDFファイル名が正しいか確認

### テキストが表示されない場合
- テキストファイル名が `PDFファイル名_ja_fixed.txt` の形式になっているか確認
- ファイルのエンコーディングがUTF-8か確認