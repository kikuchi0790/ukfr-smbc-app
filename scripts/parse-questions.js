const fs = require('fs');
const path = require('path');

const questionsFile = path.join(__dirname, '../../UKFR_ED31_Questions_extracted.txt');
const answersFile = path.join(__dirname, '../../UKFR_ED31_Answers_extracted.txt');
const outputFile = path.join(__dirname, '../public/data/all-questions.json');

function parseQuestions() {
  const questionsContent = fs.readFileSync(questionsFile, 'utf-8');
  const answersContent = fs.readFileSync(answersFile, 'utf-8');
  
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  
  const questionLines = questionsContent.split('\n');
  
  for (let i = 0; i < questionLines.length; i++) {
    const line = questionLines[i].trim();
    
    // Question number pattern (e.g., "1.", "2.", etc.)
    const questionMatch = line.match(/^(\d+)\.\s*$/);
    if (questionMatch) {
      if (currentQuestion) {
        questions.push({
          ...currentQuestion,
          options: currentOptions
        });
      }
      
      const questionNum = parseInt(questionMatch[1]);
      let questionText = '';
      i++;
      
      // Collect question text until we hit an option
      while (i < questionLines.length && !questionLines[i].trim().match(/^[A-D]\s*$/)) {
        if (questionLines[i].trim()) {
          questionText += (questionText ? ' ' : '') + questionLines[i].trim();
        }
        i++;
      }
      i--; // Back up one line
      
      currentQuestion = {
        id: questionNum,
        question: questionText,
        category: getCategory(questionNum)
      };
      currentOptions = [];
    }
    
    // Option pattern (A, B, C, D)
    const optionMatch = line.match(/^([A-D])\s*$/);
    if (optionMatch && currentQuestion) {
      const optionLetter = optionMatch[1];
      let optionText = '';
      i++;
      
      // Collect option text
      while (i < questionLines.length && 
             !questionLines[i].trim().match(/^[A-D]\s*$/) && 
             !questionLines[i].trim().match(/^\d+\.\s*$/) &&
             !questionLines[i].trim().match(/^\d{7}$/)) {
        if (questionLines[i].trim()) {
          optionText += (optionText ? ' ' : '') + questionLines[i].trim();
        }
        i++;
      }
      i--; // Back up one line
      
      currentOptions.push({
        letter: optionLetter,
        text: optionText
      });
    }
    
    // Question ID pattern (7-digit number)
    const idMatch = line.match(/^(\d{7})$/);
    if (idMatch && currentQuestion) {
      currentQuestion.questionId = idMatch[1];
    }
  }
  
  // Don't forget the last question
  if (currentQuestion) {
    questions.push({
      ...currentQuestion,
      options: currentOptions
    });
  }
  
  // Parse answers
  const answerMap = parseAnswers(answersContent);
  
  // Merge answers with questions
  questions.forEach(q => {
    const answer = answerMap[q.questionId];
    if (answer) {
      q.correctAnswer = answer.letter;
      q.explanation = answer.explanation;
    }
  });
  
  return questions;
}

function parseAnswers(content) {
  const answerMap = {};
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Answer pattern (e.g., "1.", "2.", etc.)
    const answerMatch = line.match(/^(\d+)\.\s*$/);
    if (answerMatch && i + 1 < lines.length) {
      const answerNum = parseInt(answerMatch[1]);
      const nextLine = lines[i + 1].trim();
      
      // Check if next line is a letter (A, B, C, D)
      const letterMatch = nextLine.match(/^([A-D])$/);
      if (letterMatch) {
        let explanation = '';
        let questionId = '';
        i += 2;
        
        // Collect explanation
        while (i < lines.length && 
               !lines[i].trim().match(/^\d+\.\s*$/) && 
               !lines[i].trim().match(/^Page\s+\d+/)) {
          if (lines[i].trim().match(/^(\d{7})$/)) {
            questionId = lines[i].trim();
          } else if (lines[i].trim()) {
            explanation += (explanation ? ' ' : '') + lines[i].trim();
          }
          i++;
        }
        i--; // Back up one line
        
        if (questionId) {
          answerMap[questionId] = {
            letter: letterMatch[1],
            explanation: explanation
          };
        }
      }
    }
  }
  
  return answerMap;
}

function getCategory(questionNum) {
  // Sample categorization - adjust based on actual question distribution
  if (questionNum <= 140) return "Regulatory Framework";
  if (questionNum <= 280) return "Authorization";
  if (questionNum <= 480) return "Conduct of Business";
  if (questionNum <= 600) return "Market Integrity";
  if (questionNum <= 750) return "Financial Crime";
  return "Complaints";
}

// Parse and save questions
const allQuestions = parseQuestions();

// Create different question sets
const questionSets = {
  express: allQuestions.slice(0, 50),
  essential: allQuestions.slice(0, 300),
  standard: allQuestions.slice(0, 600),
  complete: allQuestions
};

// Save all questions
fs.writeFileSync(outputFile, JSON.stringify(allQuestions, null, 2));

// Save question sets
Object.entries(questionSets).forEach(([level, questions]) => {
  const setFile = path.join(__dirname, `../public/data/questions-${level}.json`);
  fs.writeFileSync(setFile, JSON.stringify(questions, null, 2));
});

console.log(`Parsed ${allQuestions.length} questions`);
console.log('Question sets created:');
console.log('- Express:', questionSets.express.length);
console.log('- Essential:', questionSets.essential.length);
console.log('- Standard:', questionSets.standard.length);
console.log('- Complete:', questionSets.complete.length);