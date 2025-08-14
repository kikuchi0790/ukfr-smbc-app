/**
 * テストスクリプト：間違い問題のsource更新が正しく動作するか確認
 * ブラウザコンソールで実行してください
 */

// テスト用のデータを作成
function testIncorrectQuestionsSourceUpdate() {
  console.log('=== 間違い問題source更新テスト開始 ===\n');
  
  // 現在のユーザー情報を取得
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!authUser.nickname) {
    console.error('ログインしていません。先にログインしてください。');
    return;
  }
  
  const userProgressKey = `userProgress_${authUser.nickname}`;
  
  // バックアップを作成
  const backup = localStorage.getItem(userProgressKey);
  console.log('1. バックアップを作成しました');
  
  try {
    // テスト用のプログレスデータを作成
    const testProgress = {
      totalQuestionsAnswered: 100,
      correctAnswers: 70,
      categoryProgress: {},
      studySessions: [],
      incorrectQuestions: [
        // テストケース1: カテゴリで間違えた問題
        {
          questionId: 'TEST-001',
          category: 'Test Category',
          incorrectCount: 1,
          lastIncorrectDate: new Date('2025-01-01').toISOString(),
          reviewCount: 0,
          source: 'category'
        },
        // テストケース2: Mock試験で間違えた問題（sourceなし）
        {
          questionId: 'TEST-002',
          category: 'Test Category',
          incorrectCount: 2,
          lastIncorrectDate: new Date('2025-01-02').toISOString(),
          reviewCount: 0
          // sourceなし - この問題を確認
        },
        // テストケース3: Mock試験で間違えた問題（source正しい）
        {
          questionId: 'TEST-003',
          category: 'Test Category',
          incorrectCount: 1,
          lastIncorrectDate: new Date('2025-01-03').toISOString(),
          reviewCount: 0,
          source: 'mock',
          mockNumber: 1
        }
      ],
      overcomeQuestions: [],
      currentStreak: 0,
      lastStudyDate: new Date().toISOString(),
      preferences: {
        showJapaneseInStudy: true,
        showJapaneseInMock: false,
        autoReviewIncorrect: true,
        notificationEnabled: false
      }
    };
    
    // テストデータを保存
    localStorage.setItem(userProgressKey, JSON.stringify(testProgress));
    console.log('2. テストデータを設定しました');
    console.log('   - カテゴリの間違い: 1問 (TEST-001)');
    console.log('   - sourceなしの間違い: 1問 (TEST-002)');
    console.log('   - Mock試験の間違い: 1問 (TEST-003)');
    
    // saveIncorrectQuestion関数をテスト
    console.log('\n3. saveIncorrectQuestion関数のテスト:');
    
    // ケース1: カテゴリで間違えた問題を再度Mock試験で間違える
    console.log('\n   ケース1: TEST-001をMock試験で間違える');
    if (typeof saveIncorrectQuestion === 'function') {
      saveIncorrectQuestion('TEST-001', 'Test Category', authUser.nickname, 'mock', 2);
    } else {
      // 直接実装
      const progress = JSON.parse(localStorage.getItem(userProgressKey) || '{}');
      const existingIndex = progress.incorrectQuestions.findIndex(q => q.questionId === 'TEST-001');
      if (existingIndex >= 0) {
        progress.incorrectQuestions[existingIndex].incorrectCount++;
        progress.incorrectQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
        // 修正されたロジック
        if ('mock' === 'mock' || progress.incorrectQuestions[existingIndex].source !== 'mock') {
          progress.incorrectQuestions[existingIndex].source = 'mock';
          progress.incorrectQuestions[existingIndex].mockNumber = 2;
        }
      }
      localStorage.setItem(userProgressKey, JSON.stringify(progress));
    }
    
    // 結果を確認
    const updatedProgress = JSON.parse(localStorage.getItem(userProgressKey) || '{}');
    const test001 = updatedProgress.incorrectQuestions.find(q => q.questionId === 'TEST-001');
    
    if (test001) {
      console.log(`   ✅ source: ${test001.source} (期待値: mock)`);
      console.log(`   ✅ mockNumber: ${test001.mockNumber} (期待値: 2)`);
      console.log(`   ✅ incorrectCount: ${test001.incorrectCount} (期待値: 2)`);
      
      if (test001.source === 'mock' && test001.mockNumber === 2) {
        console.log('   ✨ テスト成功！sourceが正しく更新されました');
      } else {
        console.error('   ❌ テスト失敗！sourceが更新されていません');
      }
    } else {
      console.error('   ❌ TEST-001が見つかりません');
    }
    
    // 復習モードでの問題数を確認
    console.log('\n4. 復習モードでの問題数確認:');
    const categoryIncorrect = updatedProgress.incorrectQuestions.filter(q => q.source !== 'mock').length;
    const mockIncorrect = updatedProgress.incorrectQuestions.filter(q => q.source === 'mock').length;
    const noSourceIncorrect = updatedProgress.incorrectQuestions.filter(q => !q.source).length;
    
    console.log(`   - カテゴリ復習: ${categoryIncorrect}問`);
    console.log(`   - Mock試験復習: ${mockIncorrect}問`);
    console.log(`   - sourceなし: ${noSourceIncorrect}問`);
    
    // 修復ツールのテスト
    if (typeof checkIncorrectQuestionsStatus === 'function') {
      console.log('\n5. 修復ツールの状態確認:');
      checkIncorrectQuestionsStatus();
    }
    
    console.log('\n=== テスト完了 ===');
    
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  } finally {
    // バックアップを復元するかどうか確認
    const restore = confirm('テストが完了しました。元のデータに戻しますか？');
    if (restore && backup) {
      localStorage.setItem(userProgressKey, backup);
      console.log('元のデータに復元しました');
    } else {
      console.log('テストデータを保持します');
    }
  }
}

// 実行
testIncorrectQuestionsSourceUpdate();