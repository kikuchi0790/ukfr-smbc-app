import { Category } from '@/types';

export interface CategoryInfo {
  name: Category;
  totalQuestions: number;
  nameJa?: string;
}

export const categories: CategoryInfo[] = [
  { name: "The Regulatory Environment", totalQuestions: 42, nameJa: "規制環境" },
  { name: "The Financial Services and Markets Act 2000 and Financial Services Act 2012", totalQuestions: 99, nameJa: "金融サービス市場法" },
  { name: "Associated Legislation and Regulation", totalQuestions: 100, nameJa: "関連法規制" },
  { name: "The FCA Conduct of Business Sourcebook/Client Assets", totalQuestions: 125, nameJa: "FCA行動規範・顧客資産" },
  { name: "Complaints and Redress", totalQuestions: 32, nameJa: "苦情と救済" },
  { name: "Regulations: Mock 1", totalQuestions: 75 },
  { name: "Regulations: Mock 2", totalQuestions: 75 },
  { name: "Regulations: Mock 3", totalQuestions: 75 },
  { name: "Regulations: Mock 4", totalQuestions: 75 },
  { name: "Regulations: Mock 5", totalQuestions: 75 },
  { name: "Regulations: Final Study Questions", totalQuestions: 62, nameJa: "最終学習問題" }
];

export function getCategoryInfo(categoryName: Category): CategoryInfo | undefined {
  return categories.find(c => c.name === categoryName);
}

export function getTotalQuestionsForCategory(categoryName: Category): number {
  const category = getCategoryInfo(categoryName);
  return category?.totalQuestions || 0;
}