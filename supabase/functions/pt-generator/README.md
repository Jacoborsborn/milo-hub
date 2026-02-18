# PT-Generator Edge Function

Supabase Edge Function for generating meal and workout plans for Physical Therapy clients.

## Overview

This function generates personalized meal and workout plans using AI (OpenAI GPT models) based on client preferences, dietary restrictions, and fitness goals.

## Features

- **Meal Plan Generation**: Creates weekly meal plans with recipes
- **Workout Plan Generation**: Generates workout routines
- **Grocery List Building**: Automatically builds grocery lists from meal plans
- **Diet & Allergy Support**: Filters foods based on dietary preferences and allergies
- **Budget Tiers**: Supports low/medium/high budget options

## Dependencies

- OpenAI API (for meal and workout generation)
- Anthropic Claude (optional, for some features)
- Shared utilities from `../_shared/`

## Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key for meal/workout generation
- `ANTHROPIC_API_KEY` - (Optional) Anthropic API key

## Usage

### Request Format

```json
{
  "mealInputs": {
    "dietType": "balanced",
    "caloriesTargetPerDay": 2000,
    "days": 7,
    "mealsPerDay": 4,
    "dietGoal": "maintain",
    "allergies": ["dairy", "gluten"],
    "restrictions": [],
    "budgetTier": "medium"
  },
  "workoutInputs": {
    "fitnessLevel": "intermediate",
    "workoutsPerWeek": 4,
    "goal": "strength"
  }
}
```

### Response Format

```json
{
  "success": true,
  "data": {
    "mealPlan": { ... },
    "workoutPlan": { ... }
  }
}
```

## Deployment

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy pt-generator
```

## Local Development

```bash
# Serve locally
supabase functions serve pt-generator --env-file .env.local
```

## File Structure

```
supabase/functions/
├── pt-generator/
│   ├── index.ts              # Main function handler
│   ├── foods_lightweight.json # Food data
│   └── README.md
└── _shared/
    ├── food-map.ts           # Food definitions
    ├── food-map.lean.ts      # Lean food data
    ├── grocery-builder.ts    # Grocery list builder
    ├── grocery_rules_uk.json # UK grocery rules
    ├── pack_catalog.json     # Pack catalog
    └── pack-selector.ts      # Pack selection logic
```
