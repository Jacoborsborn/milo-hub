/**
 * Format plan JSON into readable plain text for client delivery
 */

export function formatPlanForClient(plan: any): string {
  if (!plan || typeof plan !== "object") {
    return JSON.stringify(plan, null, 2);
  }

  // Detect plan type based on structure
  const isWorkout = plan.workoutPlan !== undefined || 
                    plan.workoutType !== undefined || 
                    plan.daysPerWeek !== undefined ||
                    (plan.days && Array.isArray(plan.days) && plan.days.length > 0 && 
                     (plan.days[0]?.blocks || plan.days[0]?.exercises));

  const isMeal = plan.mealPlan !== undefined ||
                 plan.dietStyle !== undefined ||
                 plan.dailyCaloriesTarget !== undefined ||
                 plan.mealsPerDay !== undefined ||
                 (plan.days && Array.isArray(plan.days) && plan.days.length > 0 && 
                  (plan.days[0]?.meals || plan.days[0]?.breakfast || plan.days[0]?.lunch));

  // Extract the actual plan data (handle nested structure)
  const planData = plan.mealPlan || plan.workoutPlan || plan;

  if (isWorkout) {
    return formatWorkoutPlan(planData);
  } else if (isMeal) {
    return formatMealPlan(planData);
  }

  // Fallback to JSON if structure is unknown
  return JSON.stringify(plan, null, 2);
}

function formatWorkoutPlan(plan: any): string {
  const lines: string[] = [];
  
  // Header
  const planName = plan.plan_name || "Workout Plan";
  const generatedAt = plan.generated_at 
    ? new Date(plan.generated_at).toLocaleDateString()
    : "N/A";
  
  lines.push("=".repeat(50));
  lines.push(planName.toUpperCase());
  lines.push(`Generated: ${generatedAt}`);
  lines.push("=".repeat(50));
  lines.push("");

  // Plan metadata
  if (plan.workoutType) {
    lines.push(`Workout Type: ${plan.workoutType}`);
  }
  if (plan.daysPerWeek) {
    lines.push(`Days Per Week: ${plan.daysPerWeek}`);
  }
  if (plan.sessionLengthMinTarget) {
    lines.push(`Session Length: ${plan.sessionLengthMinTarget} minutes`);
  }
  if (plan.split) {
    lines.push(`Split: ${plan.split}`);
  }
  lines.push("");

  // Days
  if (plan.days && Array.isArray(plan.days)) {
    plan.days.forEach((day: any, index: number) => {
      const dayLabel = day.label || day.dayLabel || `Day ${day.dayIndex !== undefined ? day.dayIndex : index + 1}`;
      lines.push(dayLabel.toUpperCase());
      
      if (day.primaryFocus) {
        lines.push(`Focus: ${day.primaryFocus}`);
      }
      if (day.estimatedSessionMin) {
        lines.push(`Duration: ${day.estimatedSessionMin} minutes`);
      }
      lines.push("");

      // Blocks (strength, accessory, cardio)
      if (day.blocks && Array.isArray(day.blocks)) {
        day.blocks.forEach((block: any) => {
          if (block.blockType) {
            lines.push(`${block.blockType.charAt(0).toUpperCase() + block.blockType.slice(1)}:`);
          }
          
          if (block.items && Array.isArray(block.items)) {
            block.items.forEach((item: any) => {
              const exerciseName = item.name || "Exercise";
              let exerciseLine = `- ${exerciseName}`;
              
              if (item.sets && item.reps) {
                exerciseLine += ` — ${item.sets}x${item.reps}`;
              } else if (item.sets) {
                exerciseLine += ` — ${item.sets} sets`;
              } else if (item.durationMin) {
                exerciseLine += ` — ${item.durationMin} minutes`;
              }
              
              if (item.intensity) {
                exerciseLine += ` (${item.intensity})`;
              }
              
              lines.push(exerciseLine);
              
              if (typeof item.notes === "string" && item.notes.trim()) {
                const notes = item.notes.split("\n").filter((n: string) => n.trim());
                notes.forEach((note: string) => {
                  lines.push(`  ${note.trim()}`);
                });
              }
            });
          }
          
          lines.push("");
        });
      }
      
      // Legacy exercises array (if blocks not present)
      if (!day.blocks && day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach((exercise: any) => {
          const exerciseName = exercise.name || exercise.exercise || "Exercise";
          let exerciseLine = `- ${exerciseName}`;
          
          if (exercise.sets && exercise.reps) {
            exerciseLine += ` — ${exercise.sets}x${exercise.reps}`;
          }
          
          lines.push(exerciseLine);
        });
        lines.push("");
      }
    });
  }

  return lines.join("\n");
}

function formatMealPlan(plan: any): string {
  const lines: string[] = [];
  
  // Header
  const planName = plan.plan_name || "Meal Plan";
  const generatedAt = plan.generated_at 
    ? new Date(plan.generated_at).toLocaleDateString()
    : "N/A";
  
  lines.push("=".repeat(50));
  lines.push(planName.toUpperCase());
  lines.push(`Generated: ${generatedAt}`);
  lines.push("=".repeat(50));
  lines.push("");

  // Plan metadata
  if (plan.dietStyle) {
    lines.push(`Diet Style: ${plan.dietStyle}`);
  }
  if (plan.dailyCaloriesTarget) {
    lines.push(`Daily Calories Target: ${plan.dailyCaloriesTarget}`);
  }
  if (plan.mealsPerDay) {
    lines.push(`Meals Per Day: ${plan.mealsPerDay}`);
  }
  lines.push("");

  // Days
  if (plan.days && Array.isArray(plan.days)) {
    plan.days.forEach((day: any, index: number) => {
      const dayLabel = day.dayLabel || day.label || `Day ${day.dayIndex !== undefined ? day.dayIndex : index + 1}`;
      lines.push(dayLabel.toUpperCase());
      lines.push("");

      // Meals array
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach((meal: any) => {
          const mealName = meal.mealName || meal.name || "Meal";
          const mealType = meal.mealType || meal.type || "";
          const mealLabel = mealType ? `${mealType} — ${mealName}` : mealName;
          
          lines.push(mealLabel);
          
          if (meal.calories) {
            lines.push(`Calories: ${meal.calories}`);
          }
          if (meal.protein) {
            lines.push(`Protein: ${meal.protein}g`);
          }
          if (meal.carbs) {
            lines.push(`Carbs: ${meal.carbs}g`);
          }
          if (meal.fat) {
            lines.push(`Fat: ${meal.fat}g`);
          }
          
          // Ingredients
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            lines.push("Ingredients:");
            meal.ingredients.forEach((ing: any) => {
              if (typeof ing === "string") {
                lines.push(`- ${ing}`);
              } else if (ing.name) {
                const amount = ing.amount ? ` (${ing.amount})` : "";
                lines.push(`- ${ing.name}${amount}`);
              }
            });
          }
          
          // Recipe/instructions
          if (meal.recipe) {
            lines.push("Recipe:");
            let recipeLines: string[] = [];

            if (typeof meal.recipe === "string") {
              recipeLines = meal.recipe.split("\n").filter((l: string) => l.trim());
            } else if (Array.isArray(meal.recipe)) {
              recipeLines = meal.recipe.filter((l: any) => typeof l === "string");
            }

            recipeLines.forEach((line: string) => {
              lines.push(`  ${line.trim()}`);
            });
          }
          
          lines.push("");
        });
      }
      
      // Legacy meal structure (breakfast, lunch, dinner, snacks)
      const mealTypes = ["breakfast", "lunch", "dinner", "snack", "snacks"];
      mealTypes.forEach((mealType) => {
        if (day[mealType]) {
          const meal = day[mealType];
          const mealName = meal.name || meal.mealName || mealType.charAt(0).toUpperCase() + mealType.slice(1);
          
          lines.push(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} — ${mealName}`);
          
          if (meal.calories) {
            lines.push(`Calories: ${meal.calories}`);
          }
          if (meal.protein) {
            lines.push(`Protein: ${meal.protein}g`);
          }
          
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            lines.push("Ingredients:");
            meal.ingredients.forEach((ing: any) => {
              if (typeof ing === "string") {
                lines.push(`- ${ing}`);
              } else if (ing.name) {
                lines.push(`- ${ing.name}`);
              }
            });
          }
          
          lines.push("");
        }
      });
    });
  }

  return lines.join("\n");
}
