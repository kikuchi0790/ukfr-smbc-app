/**
 * Debug script to analyze localStorage data for progress tracking issues
 * Run this in the browser console to debug why progress exceeds 100%
 */

(function debugProgress() {
  console.log('=== UK Financial Regulation Progress Debug ===\n');
  
  // Get data from localStorage
  const userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
  const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '{}');
  
  // Category information (should match category-utils.ts)
  const categoryInfo = {
    "The Regulatory Environment": 42,
    "The Financial Services and Markets Act 2000 and Financial Services Act 2012": 99,
    "Associated Legislation and Regulation": 100,
    "The FCA Conduct of Business Sourcebook/Client Assets": 125,
    "Complaints and Redress": 32,
    "Regulations: Mock 1": 75,
    "Regulations: Mock 2": 75,
    "Regulations: Mock 3": 75,
    "Regulations: Mock 4": 75,
    "Regulations: Mock 5": 75,
    "Regulations: Final Study Questions": 62
  };
  
  console.log('1. UserProgress Category Data:');
  console.log('================================');
  
  if (!userProgress.categoryProgress) {
    console.log('❌ No categoryProgress found in userProgress');
  } else {
    Object.entries(userProgress.categoryProgress).forEach(([category, progress]) => {
      const expected = categoryInfo[category];
      const percentage = Math.round((progress.answeredQuestions / progress.totalQuestions) * 100);
      
      console.log(`\n📚 ${category}:`);
      console.log(`   Answered: ${progress.answeredQuestions}/${progress.totalQuestions} (${percentage}%)`);
      console.log(`   Correct: ${progress.correctAnswers}`);
      
      if (progress.totalQuestions !== expected) {
        console.log(`   ⚠️  Total questions mismatch! Expected: ${expected}, Found: ${progress.totalQuestions}`);
      }
      
      if (progress.answeredQuestions > progress.totalQuestions) {
        console.log(`   ❌ OVERFLOW: Answered (${progress.answeredQuestions}) > Total (${progress.totalQuestions})`);
      }
      
      if (progress.correctAnswers > progress.answeredQuestions) {
        console.log(`   ❌ LOGIC ERROR: Correct (${progress.correctAnswers}) > Answered (${progress.answeredQuestions})`);
      }
    });
  }
  
  console.log('\n\n2. AnsweredQuestions Tracker Data:');
  console.log('====================================');
  
  if (Object.keys(answeredQuestions).length === 0) {
    console.log('❌ No answeredQuestions tracker data found');
  } else {
    Object.entries(answeredQuestions).forEach(([category, questionIds]) => {
      const uniqueIds = new Set(questionIds);
      const duplicates = questionIds.length - uniqueIds.size;
      
      console.log(`\n📝 ${category}:`);
      console.log(`   Total entries: ${questionIds.length}`);
      console.log(`   Unique questions: ${uniqueIds.size}`);
      
      if (duplicates > 0) {
        console.log(`   ⚠️  Duplicates found: ${duplicates}`);
        
        // Find duplicate IDs
        const idCount = {};
        questionIds.forEach(id => {
          idCount[id] = (idCount[id] || 0) + 1;
        });
        
        const duplicateIds = Object.entries(idCount)
          .filter(([id, count]) => count > 1)
          .map(([id, count]) => `${id} (${count}x)`);
        
        console.log(`   Duplicate IDs: ${duplicateIds.join(', ')}`);
      }
      
      // Check if this exceeds the expected total
      const expected = categoryInfo[category];
      if (uniqueIds.size > expected) {
        console.log(`   ❌ OVERFLOW: Unique questions (${uniqueIds.size}) > Expected total (${expected})`);
      }
    });
  }
  
  console.log('\n\n3. Cross-Check Analysis:');
  console.log('========================');
  
  if (userProgress.categoryProgress && Object.keys(answeredQuestions).length > 0) {
    Object.keys(categoryInfo).forEach(category => {
      const progress = userProgress.categoryProgress[category];
      const trackerIds = answeredQuestions[category] || [];
      const uniqueTrackerCount = new Set(trackerIds).size;
      
      if (progress && trackerIds.length > 0) {
        console.log(`\n🔍 ${category}:`);
        console.log(`   Progress says: ${progress.answeredQuestions} answered`);
        console.log(`   Tracker has: ${uniqueTrackerCount} unique IDs`);
        
        if (progress.answeredQuestions !== uniqueTrackerCount) {
          console.log(`   ⚠️  MISMATCH: Progress (${progress.answeredQuestions}) != Tracker (${uniqueTrackerCount})`);
        }
      }
    });
  }
  
  console.log('\n\n4. Recommendations:');
  console.log('===================');
  
  let hasIssues = false;
  
  // Check for overflows
  Object.entries(userProgress.categoryProgress || {}).forEach(([category, progress]) => {
    if (progress.answeredQuestions > progress.totalQuestions) {
      hasIssues = true;
      console.log(`\n🔧 Fix overflow in "${category}":`);
      console.log(`   Run: fixCategoryOverflow("${category}")`);
    }
  });
  
  // Check for duplicates in tracker
  Object.entries(answeredQuestions).forEach(([category, questionIds]) => {
    const uniqueIds = new Set(questionIds);
    if (questionIds.length > uniqueIds.size) {
      hasIssues = true;
      console.log(`\n🔧 Remove duplicates in "${category}" tracker:`);
      console.log(`   Run: removeDuplicatesFromTracker("${category}")`);
    }
  });
  
  if (!hasIssues) {
    console.log('\n✅ No issues detected!');
  } else {
    console.log('\n\n5. Quick Fix Functions:');
    console.log('=======================');
    console.log('Copy and paste these functions to fix issues:\n');
    
    console.log(`
function fixCategoryOverflow(category) {
  const progress = JSON.parse(localStorage.getItem('userProgress'));
  if (progress?.categoryProgress?.[category]) {
    const cat = progress.categoryProgress[category];
    cat.answeredQuestions = Math.min(cat.answeredQuestions, cat.totalQuestions);
    cat.correctAnswers = Math.min(cat.correctAnswers, cat.answeredQuestions);
    localStorage.setItem('userProgress', JSON.stringify(progress));
    console.log('✅ Fixed overflow for', category);
  }
}

function removeDuplicatesFromTracker(category) {
  const tracker = JSON.parse(localStorage.getItem('answeredQuestions') || '{}');
  if (tracker[category]) {
    tracker[category] = [...new Set(tracker[category])];
    localStorage.setItem('answeredQuestions', JSON.stringify(tracker));
    console.log('✅ Removed duplicates for', category);
  }
}

function fixAllIssues() {
  // Fix all overflows
  const progress = JSON.parse(localStorage.getItem('userProgress'));
  Object.keys(progress?.categoryProgress || {}).forEach(category => {
    fixCategoryOverflow(category);
  });
  
  // Remove all duplicates
  const tracker = JSON.parse(localStorage.getItem('answeredQuestions') || '{}');
  Object.keys(tracker).forEach(category => {
    removeDuplicatesFromTracker(category);
  });
  
  console.log('✅ All issues fixed! Refresh the page to see changes.');
}
    `);
  }
  
  console.log('\n\n=== End of Debug Report ===');
})();