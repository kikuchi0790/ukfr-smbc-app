const fs = require('fs');
const path = require('path');

// Define the correct category structure and question counts
const categoryMapping = {
  "The Regulatory Environment": { start: 1, count: 42 },
  "The Financial Services and Markets Act 2000 and Financial Services Act 2012": { start: 43, count: 99 },
  "Associated Legislation and Regulation": { start: 142, count: 100 },
  "The FCA Conduct of Business Sourcebook/Client Assets": { start: 242, count: 125 },
  "Complaints and Redress": { start: 367, count: 32 },
  "Regulations: Mock 1": { start: 399, count: 75 },
  "Regulations: Mock 2": { start: 474, count: 75 },
  "Regulations: Mock 3": { start: 549, count: 75 },
  "Regulations: Mock 4": { start: 624, count: 75 },
  "Regulations: Mock 5": { start: 699, count: 75 },
  "Regulations: Final Study Questions": { start: 774, count: 62 }
};

const inputFile = path.join(__dirname, '../public/data/all-questions.json');
const outputFile = path.join(__dirname, '../public/data/all-questions-updated.json');

// Read the current questions
const questions = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

// Create a global ID counter
let globalId = 1;
let categoryQuestionId = 1;
let currentCategory = null;

// Update questions with correct categories and global IDs
const updatedQuestions = questions.map((question, index) => {
  // Determine which category this question belongs to
  for (const [categoryName, categoryInfo] of Object.entries(categoryMapping)) {
    if (globalId >= categoryInfo.start && globalId < categoryInfo.start + categoryInfo.count) {
      currentCategory = categoryName;
      
      // Reset category question ID when entering a new category
      if (globalId === categoryInfo.start) {
        categoryQuestionId = 1;
      }
      break;
    }
  }
  
  // Create updated question with global ID and correct category
  const updatedQuestion = {
    ...question,
    globalId: globalId,
    categoryId: categoryQuestionId,
    category: currentCategory || question.category
  };
  
  globalId++;
  categoryQuestionId++;
  
  return updatedQuestion;
});

// Save updated questions
fs.writeFileSync(outputFile, JSON.stringify(updatedQuestions, null, 2));

// Also update the main file
fs.writeFileSync(inputFile, JSON.stringify(updatedQuestions, null, 2));

// Create category-specific files
Object.entries(categoryMapping).forEach(([categoryName, categoryInfo]) => {
  const categoryQuestions = updatedQuestions.filter(q => q.category === categoryName);
  const fileName = categoryName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const categoryFile = path.join(__dirname, `../public/data/category-${fileName}.json`);
  fs.writeFileSync(categoryFile, JSON.stringify(categoryQuestions, null, 2));
});

console.log('Categories updated successfully!');
console.log('\nCategory Summary:');
Object.entries(categoryMapping).forEach(([categoryName, categoryInfo]) => {
  const categoryQuestions = updatedQuestions.filter(q => q.category === categoryName);
  console.log(`- ${categoryName}: ${categoryQuestions.length} questions`);
});

console.log(`\nTotal questions: ${updatedQuestions.length}`);