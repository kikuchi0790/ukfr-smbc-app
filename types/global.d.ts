declare global {
  interface Window {
    progressSync?: {
      sync: (nickname?: string, strategy?: 'use_higher' | 'trust_progress' | 'trust_tracker') => Promise<any>;
      autoRepair: (nickname?: string) => Promise<boolean>;
      incrementAnswered: (category: string, questionId: string, nickname?: string) => boolean;
    };
    dataBackup?: {
      create: (userId?: string, nickname?: string) => Promise<any>;
      restore: (backup: any, userId?: string, nickname?: string, restoreToFirestore?: boolean) => Promise<boolean>;
      getBackups: (nickname?: string) => any[];
      checkIntegrity: (progress: any, answeredQuestions: any) => any;
      debug: (nickname?: string) => void;
    };
    dataMigration?: {
      run: (nickname?: string) => Promise<any>;
      rollback: (backupIndex?: number, nickname?: string, restoreToFirestore?: boolean) => Promise<boolean>;
      check: (nickname?: string) => Promise<void>;
      needsMigration: (nickname?: string) => boolean;
      migrateOld: (nickname: string) => boolean;
    };
    debugProgress?: () => void;
  }
}

export {};