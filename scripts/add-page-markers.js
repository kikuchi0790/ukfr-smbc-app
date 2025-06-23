const fs = require('fs');
const path = require('path');

// テキストファイルから各ページの最初の実質的なコンテンツを抽出
function extractPageContent(txtFile) {
  const content = fs.readFileSync(txtFile, 'utf-8');
  const lines = content.split('\n');
  const pageMarkers = [];
  
  let currentPage = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^ページ \d+$/)) {
      currentPage = parseInt(lines[i].match(/\d+/)[0]);
      let firstContent = '';
      let contentLines = [];
      
      // ページ番号の後の最初の実質的なコンテンツを探す
      for (let j = i + 1; j < lines.length && j < i + 50; j++) {
        const line = lines[j].trim();
        
        // 次のページマーカーに到達したら終了
        if (lines[j].match(/^ページ \d+$/)) {
          break;
        }
        
        // 空行や区切り線をスキップ
        if (!line || line.match(/^={10,}$/)) {
          continue;
        }
        
        // ヘッダー行をスキップ（CISI UK Financial Regulation: Checkpoint）
        if (line.match(/^CISI UK Financial Regulation/)) {
          continue;
        }
        
        // 単独の数字（ページ番号）をスキップ
        if (line.match(/^\d{1,3}$/)) {
          continue;
        }
        
        // 最初の実質的なコンテンツを見つけた
        if (!firstContent && line.length > 10) {
          firstContent = line;
          contentLines.push(line);
        } else if (firstContent && contentLines.length < 3) {
          // コンテキストとして次の数行も保存
          contentLines.push(line);
        }
      }
      
      if (firstContent) {
        pageMarkers.push({
          page: currentPage,
          searchText: firstContent,
          context: contentLines.join(' ')
        });
      } else {
        console.log(`警告: ページ ${currentPage} の実質的なコンテンツが見つかりません`);
      }
    }
  }
  
  return pageMarkers;
}

// HTMLファイルにページマーカーを挿入
function addPageMarkersToHTML(htmlFile, pageMarkers) {
  let html = fs.readFileSync(htmlFile, 'utf-8');
  const originalHtml = html;
  let modifiedCount = 0;
  
  // 各ページマーカーをHTMLに追加
  pageMarkers.forEach(marker => {
    // HTMLエンティティをデコード
    const searchText = marker.searchText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // より柔軟な検索パターン（空白文字を許容）
    const searchPattern = searchText
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s*');
    
    // まず完全一致を試す
    let regex = new RegExp(`(${searchPattern})`, 'i');
    let match = html.match(regex);
    
    // 完全一致が見つからない場合、最初の数単語で検索
    if (!match) {
      const words = marker.searchText.split(/\s+/).slice(0, 5).join('\\s*');
      const shortPattern = words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(`(${shortPattern})`, 'i');
      match = html.match(regex);
    }
    
    if (match) {
      // 既にページマーカーがある場合はスキップ
      const checkPattern = `id="page-${marker.page}"[^>]*>[^<]*${match[1]}`;
      if (html.match(new RegExp(checkPattern, 'i'))) {
        console.log(`ページ ${marker.page} のマーカーは既に存在します`);
        return;
      }
      
      // 適切なHTML要素の前にマーカーを挿入
      const elementPattern = `(<(?:h[1-6]|p|div)[^>]*>\\s*${searchPattern})`;
      const elementRegex = new RegExp(elementPattern, 'i');
      
      if (html.match(elementRegex)) {
        html = html.replace(elementRegex, 
          `<div class="page-marker" data-page="${marker.page}" id="page-${marker.page}">` +
          `<!-- ページ ${marker.page} 開始 --></div>\n$1`
        );
        modifiedCount++;
        console.log(`✓ ページ ${marker.page} のマーカーを追加: "${marker.searchText.substring(0, 50)}..."`);
      } else {
        // 要素の外にある場合
        html = html.replace(regex, 
          `<div class="page-marker" data-page="${marker.page}" id="page-${marker.page}">` +
          `<!-- ページ ${marker.page} 開始 --></div>$1`
        );
        modifiedCount++;
        console.log(`✓ ページ ${marker.page} のマーカーを追加（要素外）: "${marker.searchText.substring(0, 50)}..."`);
      }
    } else {
      console.log(`✗ ページ ${marker.page} の開始位置が見つかりません: "${marker.searchText.substring(0, 50)}..."`);
    }
  });
  
  // CSSにページマーカーのスタイルを追加（まだない場合）
  if (!html.includes('.page-marker')) {
    const pageMarkerCSS = `
    /* ページマーカー */
    .page-marker {
      position: relative;
      margin-top: -60px;
      padding-top: 60px;
    }
    .page-marker::before {
      content: "ページ " attr(data-page);
      position: absolute;
      top: 20px;
      right: 20px;
      background: #f0f0f0;
      padding: 4px 12px;
      font-size: 14px;
      color: #666;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-weight: 500;
    }
    @media print {
      .page-marker::before {
        display: none;
      }
    }`;
    
    html = html.replace('</style>', pageMarkerCSS + '\n    </style>');
  }
  
  console.log(`\n合計 ${modifiedCount} 個のページマーカーを追加しました`);
  return html;
}

// メイン処理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('使用方法: node add-page-markers.js <txtファイル> <htmlファイル>');
    console.log('例: node add-page-markers.js public/materials/UKFR_ED32_Checkpoint_ja_fixed.txt public/materials/Checkpoint.html');
    process.exit(1);
  }
  
  const [txtFile, htmlFile] = args;
  
  if (!fs.existsSync(txtFile)) {
    console.error(`エラー: テキストファイルが見つかりません: ${txtFile}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(htmlFile)) {
    console.error(`エラー: HTMLファイルが見つかりません: ${htmlFile}`);
    process.exit(1);
  }
  
  console.log(`テキストファイルを解析中: ${txtFile}`);
  const pageMarkers = extractPageContent(txtFile);
  console.log(`${pageMarkers.length} 個のページマーカーを検出しました\n`);
  
  console.log(`HTMLファイルを更新中: ${htmlFile}`);
  const updatedHtml = addPageMarkersToHTML(htmlFile, pageMarkers);
  
  // バックアップを作成
  const backupFile = htmlFile.replace('.html', '_backup.html');
  fs.copyFileSync(htmlFile, backupFile);
  console.log(`\nバックアップを作成しました: ${backupFile}`);
  
  // 更新されたHTMLを保存
  fs.writeFileSync(htmlFile, updatedHtml, 'utf-8');
  console.log(`HTMLファイルを更新しました: ${htmlFile}`);
}

// スクリプトを実行
main();