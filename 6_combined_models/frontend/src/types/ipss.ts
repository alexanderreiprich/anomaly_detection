export interface IpssQuestion {
  question_id: string;
  question_number: number;
  question_text: string;
}

export interface IpssAnswerOption {
  answer_option_id: string;
  option_text: string;
  points: number;
}

export interface IpssResponse {
  response_id: string;
  question_id: string;
  answer_option_id: string;
  answer_value: number;
  ipss_questions: IpssQuestion;
  ipss_answer_options: IpssAnswerOption;
}

export interface IpssSubmission {
  submission_id: string;
  patient_id: string;
  score: number;
  submitted_at: string;
  ipss_responses: IpssResponse[];
}
