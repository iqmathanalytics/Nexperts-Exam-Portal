export type ExamFormState = {
  id?: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  questions: number;
  passScore: number;
  maxAttempts: number;
  price: number;
  startDate: string;
  status: "Draft" | "Published" | "Archived";
  proctoring: boolean;
  fullscreen: boolean;
  tabDetection: boolean;
  webcam: boolean;
  questionPoolId?: string | null;
  questionPoolName?: string | null;
};

export type QuestionFormState = {
  id?: string;
  examId?: string;
  title: string;
  code?: string | null;
  type: "Multiple Choice" | "True/False" | "Scenario";
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  topic: string;
  tags: string[];
  imageUrl?: string | null;
};
