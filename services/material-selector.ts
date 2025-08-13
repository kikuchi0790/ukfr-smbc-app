/**
 * Material Selector Service
 * 
 * Intelligently selects between Study Companion and Checkpoint materials
 * based on question characteristics and search results
 */

import { normalizeMaterialId } from '@/utils/material-utils';

export interface MaterialSelection {
  primary: 'UKFR_ED32_Study_Companion' | 'UKFR_ED32_Checkpoint';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  scores: {
    studyCompanion: number;
    checkpoint: number;
  };
}

export interface SearchPassage {
  materialId: string;
  page: number;
  quote: string;
  score: number;
  normalizedText?: string;
}

type QuestionType = 'theoretical' | 'practical' | 'regulatory' | 'calculation' | 'definition' | 'mixed';

export class MaterialSelector {
  /**
   * Analyze question to determine its type
   */
  private analyzeQuestionType(question: string): QuestionType {
    const lowerQuestion = question.toLowerCase();
    
    // Theoretical questions (concepts, principles, frameworks)
    if (lowerQuestion.includes('explain') || 
        lowerQuestion.includes('describe') || 
        lowerQuestion.includes('what is') ||
        lowerQuestion.includes('とは') ||
        lowerQuestion.includes('説明')) {
      return 'theoretical';
    }
    
    // Practical/application questions
    if (lowerQuestion.includes('how to') || 
        lowerQuestion.includes('when should') ||
        lowerQuestion.includes('どのように') ||
        lowerQuestion.includes('いつ')) {
      return 'practical';
    }
    
    // Regulatory/compliance questions
    if (lowerQuestion.includes('regulation') || 
        lowerQuestion.includes('compliance') ||
        lowerQuestion.includes('fca') ||
        lowerQuestion.includes('規制') ||
        lowerQuestion.includes('法令')) {
      return 'regulatory';
    }
    
    // Calculation questions (amounts, limits, percentages)
    if (/£[\d,]+/.test(lowerQuestion) || 
        /\d+%/.test(lowerQuestion) ||
        lowerQuestion.includes('limit') ||
        lowerQuestion.includes('amount') ||
        lowerQuestion.includes('限度') ||
        lowerQuestion.includes('金額')) {
      return 'calculation';
    }
    
    // Definition questions
    if (lowerQuestion.includes('definition') || 
        lowerQuestion.includes('meaning') ||
        lowerQuestion.includes('定義') ||
        lowerQuestion.includes('意味')) {
      return 'definition';
    }
    
    return 'mixed';
  }
  
  /**
   * Calculate material affinity based on question type
   */
  private getMaterialAffinity(questionType: QuestionType): { studyCompanion: number; checkpoint: number } {
    const affinityMap: Record<QuestionType, { studyCompanion: number; checkpoint: number }> = {
      theoretical: { studyCompanion: 0.8, checkpoint: 0.2 },  // Study Companion for detailed theory
      practical: { studyCompanion: 0.3, checkpoint: 0.7 },    // Checkpoint for practical examples
      regulatory: { studyCompanion: 0.7, checkpoint: 0.3 },   // Study Companion for detailed regulations
      calculation: { studyCompanion: 0.5, checkpoint: 0.5 },  // Both equally relevant
      definition: { studyCompanion: 0.6, checkpoint: 0.4 },   // Study Companion for detailed definitions
      mixed: { studyCompanion: 0.5, checkpoint: 0.5 }        // No preference
    };
    
    return affinityMap[questionType];
  }
  
  /**
   * Analyze passage distribution across materials
   */
  private analyzePassageDistribution(passages: SearchPassage[]): { 
    studyCompanionCount: number; 
    checkpointCount: number;
    studyCompanionAvgScore: number;
    checkpointAvgScore: number;
  } {
    const studyCompanionPassages = passages.filter(p => {
      const normalized = normalizeMaterialId(p.materialId);
      return normalized === 'UKFR_ED32_Study_Companion';
    });
    
    const checkpointPassages = passages.filter(p => {
      const normalized = normalizeMaterialId(p.materialId);
      return normalized === 'UKFR_ED32_Checkpoint';
    });
    
    const studyCompanionAvgScore = studyCompanionPassages.length > 0
      ? studyCompanionPassages.reduce((sum, p) => sum + p.score, 0) / studyCompanionPassages.length
      : 0;
    
    const checkpointAvgScore = checkpointPassages.length > 0
      ? checkpointPassages.reduce((sum, p) => sum + p.score, 0) / checkpointPassages.length
      : 0;
    
    return {
      studyCompanionCount: studyCompanionPassages.length,
      checkpointCount: checkpointPassages.length,
      studyCompanionAvgScore,
      checkpointAvgScore
    };
  }
  
  /**
   * Check for specific indicators in passages
   */
  private checkSpecificIndicators(question: string, passages: SearchPassage[]): {
    hasExactAmount: boolean;
    hasSectionTitle: boolean;
    hasDetailedExplanation: boolean;
  } {
    // Extract amounts from question
    const amountMatches = question.match(/£[\d,]+/g) || [];
    const percentMatches = question.match(/\d+%/g) || [];
    const allAmounts = [...amountMatches, ...percentMatches];
    
    let hasExactAmount = false;
    let hasSectionTitle = false;
    let hasDetailedExplanation = false;
    
    for (const passage of passages) {
      const text = passage.quote.toLowerCase();
      
      // Check for exact amount matches
      for (const amount of allAmounts) {
        if (passage.quote.includes(amount)) {
          hasExactAmount = true;
          break;
        }
      }
      
      // Check for section titles (usually in Checkpoint)
      if (text.includes('section') || text.includes('chapter') || /^\d+\./.test(text)) {
        hasSectionTitle = true;
      }
      
      // Check for detailed explanations (usually in Study Companion)
      if (text.length > 300 && (text.includes('because') || text.includes('therefore') || text.includes('however'))) {
        hasDetailedExplanation = true;
      }
    }
    
    return { hasExactAmount, hasSectionTitle, hasDetailedExplanation };
  }
  
  /**
   * Select optimal material based on question and search results
   */
  selectOptimalMaterial(question: string, passages: SearchPassage[]): MaterialSelection {
    // Step 1: Analyze question type
    const questionType = this.analyzeQuestionType(question);
    const affinity = this.getMaterialAffinity(questionType);
    
    // Step 2: Analyze passage distribution
    const distribution = this.analyzePassageDistribution(passages);
    
    // Step 3: Check specific indicators
    const indicators = this.checkSpecificIndicators(question, passages);
    
    // Step 4: Calculate final scores
    let studyCompanionScore = 0;
    let checkpointScore = 0;
    
    // Base score from question type affinity (weight: 30%)
    studyCompanionScore += affinity.studyCompanion * 30;
    checkpointScore += affinity.checkpoint * 30;
    
    // Score from passage count (weight: 20%)
    const totalPassages = distribution.studyCompanionCount + distribution.checkpointCount;
    if (totalPassages > 0) {
      studyCompanionScore += (distribution.studyCompanionCount / totalPassages) * 20;
      checkpointScore += (distribution.checkpointCount / totalPassages) * 20;
    }
    
    // Score from average passage scores (weight: 30%)
    const maxAvgScore = Math.max(distribution.studyCompanionAvgScore, distribution.checkpointAvgScore);
    if (maxAvgScore > 0) {
      studyCompanionScore += (distribution.studyCompanionAvgScore / maxAvgScore) * 30;
      checkpointScore += (distribution.checkpointAvgScore / maxAvgScore) * 30;
    }
    
    // Score from specific indicators (weight: 20%)
    if (indicators.hasExactAmount) {
      // Both materials can have exact amounts
      studyCompanionScore += 10;
      checkpointScore += 10;
    }
    if (indicators.hasDetailedExplanation) {
      // Favor Study Companion for detailed explanations
      studyCompanionScore += 10;
    }
    if (indicators.hasSectionTitle) {
      // Slightly favor Checkpoint for structured content
      checkpointScore += 5;
    }
    
    // Special case: FSCS questions
    if (question.toLowerCase().includes('fscs') || question.includes('£85,000')) {
      // FSCS content is primarily in Study Companion
      studyCompanionScore += 20;
    }
    
    // Determine primary material and confidence
    const primary = studyCompanionScore > checkpointScore 
      ? 'UKFR_ED32_Study_Companion' 
      : 'UKFR_ED32_Checkpoint';
    
    const scoreDifference = Math.abs(studyCompanionScore - checkpointScore);
    let confidence: 'high' | 'medium' | 'low';
    if (scoreDifference > 30) {
      confidence = 'high';
    } else if (scoreDifference > 15) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      questionType,
      primary,
      confidence,
      distribution,
      indicators
    );
    
    return {
      primary,
      confidence,
      reasoning,
      scores: {
        studyCompanion: Math.round(studyCompanionScore),
        checkpoint: Math.round(checkpointScore)
      }
    };
  }
  
  /**
   * Generate human-readable reasoning for material selection
   */
  private generateReasoning(
    questionType: QuestionType,
    primary: string,
    confidence: string,
    distribution: any,
    indicators: any
  ): string {
    const parts: string[] = [];
    
    // Question type reasoning
    parts.push(`Question type: ${questionType}.`);
    
    // Distribution reasoning
    if (distribution.studyCompanionCount > 0 || distribution.checkpointCount > 0) {
      parts.push(`Found ${distribution.studyCompanionCount} Study Companion and ${distribution.checkpointCount} Checkpoint matches.`);
    }
    
    // Indicator reasoning
    if (indicators.hasExactAmount) {
      parts.push('Exact amounts found in passages.');
    }
    if (indicators.hasDetailedExplanation) {
      parts.push('Detailed explanations available.');
    }
    
    // Material selection reasoning
    const materialName = primary === 'UKFR_ED32_Study_Companion' ? 'Study Companion' : 'Checkpoint';
    parts.push(`Selected ${materialName} with ${confidence} confidence.`);
    
    return parts.join(' ');
  }
  
  /**
   * Filter passages to only include selected material
   */
  filterPassagesByMaterial(passages: SearchPassage[], materialId: string): SearchPassage[] {
    return passages.filter(p => {
      const normalized = normalizeMaterialId(p.materialId);
      return normalized === materialId;
    });
  }
}

// Export singleton instance
export const materialSelector = new MaterialSelector();