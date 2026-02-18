/**
 * Shared request/response types for meal and workout Edge Functions.
 * Matches the payloads expected by meal-workout-generator (and the new split functions).
 */

/** Raw meal inputs as sent by the client (various key names supported). */
export interface MealInputs {
  dietaryPreference?: string;
  dietType?: string;
  caloriesTargetPerDay?: number;
  calorieGoal?: number;
  dietGoal?: string;
  goal?: string;
  budgetTier?: string;
  budget?: string;
  mealsPerDay?: number;
  days?: number;
  daysPerWeek?: number;
  preferredProteins?: string;
  proteinSources?: string | string[];
  allergies?: string | string[];
  avoid?: string | string[];
  dislikes?: string;
  restrictions?: string[] | string;
  bulkStyle?: string;
  cookingStyle?: string;
  cookingTime?: string;
  timeAvailablePerDay?: string;
  /** Week 2+ */
  isContinuationWeek?: boolean;
  previousMealTitles?: string[];
  previousWeekMeals?: string[];
  previousGroceryList?: any;
  previousWeekGroceryList?: any;
  week1Feedback?: string;
  weekFeedback?: string;
  feedback2?: string;
  feedback3?: string;
}

/** Normalized meal inputs after allergy expansion and key normalization (used by meal-engine). */
export interface NormalizedMealInputs {
  dietType: string;
  dailyCalories: number;
  days: number;
  mealsPerDay: number;
  dietGoal: string;
  allergies: string[];
  dislikes: string[];
  budgetTier: string;
  isContinuationWeek?: boolean;
  previousMealTitles?: string[];
  previousGroceryList?: any;
  week1Feedback?: string;
  feedback2?: string;
  feedback3?: string;
}

/** Raw workout inputs as sent by the client. */
export interface WorkoutInputs {
  daysPerWeek?: number;
  workoutType?: string | string[];
  sessionLengthMin?: number;
  sessionLength?: number;
  equipment?: string;
  experience?: string;
  level?: string;
  workoutSplit?: string;
  preset?: string;
  coachNotes?: string;
  notes?: string;
  goals?: string;
  restrictions?: string[];
}

/** Meal plan response shape (same as current production). */
export interface MealPlanResponse {
  plan_name: string;
  generated_at: string;
  dietStyle: string;
  dailyCaloriesTarget: number;
  mealsPerDay: number;
  days: any[];
  grocerySections: any[];
  groceryTotals: any;
}

/** Workout plan response shape (same as current production – raw JSON from AI). */
export type WorkoutPlanResponse = {
  plan_name?: string;
  generated_at?: string;
  daysPerWeek?: number;
  workoutType?: string;
  sessionLengthMinTarget?: number;
  split?: string;
  days?: any[];
  [key: string]: any;
};
